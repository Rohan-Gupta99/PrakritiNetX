package org.prakritinetx.fieldflash.engine.serial

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException

class UsbSerialManager(private val context: Context) {

    private val usbManager: UsbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
    private var activePort: UsbSerialPort? = null
    private var activeDriver: UsbSerialDriver? = null

    companion object {
        private const val TAG = "UsbSerialManager"
        const val ACTION_USB_PERMISSION = "org.prakritinetx.fieldflash.USB_PERMISSION"
    }

    fun getAvailableDevices(): List<UsbSerialDriver> {
        return UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)
    }

    fun hasPermission(device: UsbDevice): Boolean {
        return usbManager.hasPermission(device)
    }

    fun requestPermission(device: UsbDevice) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val permissionIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(ACTION_USB_PERMISSION),
            flags
        )
        usbManager.requestPermission(device, permissionIntent)
    }

    suspend fun open(
        driver: UsbSerialDriver,
        portIndex: Int = 0,
        baudRate: Int = 115200
    ): SerialConnectionState = withContext(Dispatchers.IO) {
        try {
            close()
            val device = driver.device
            if (!usbManager.hasPermission(device)) {
                requestPermission(device)
                return@withContext SerialConnectionState.Error("USB permission required for ${device.deviceName}")
            }

            val connection = usbManager.openDevice(device)
                ?: return@withContext SerialConnectionState.Error("Failed to open UsbDeviceConnection (NULL). Device may be locked or disconnected.")

            val port = driver.ports[portIndex]
            port.open(connection)
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)

            // Initial control line stabilization
            try {
                port.dtr = false
                port.rts = false
            } catch (e: Exception) {
                Log.w(TAG, "Control lines set failed: ${e.message}")
            }

            activeDriver = driver
            activePort = port

            return@withContext SerialConnectionState.Connected(
                deviceName = device.deviceName,
                driverName = driver.javaClass.simpleName,
                vendorId = device.vendorId,
                productId = device.productId,
                portNumber = portIndex
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open serial port: ${e.message}", e)
            close()
            return@withContext SerialConnectionState.Error("Error opening USB port: ${e.message}", e)
        }
    }

    suspend fun setBaudRate(baudRate: Int) = withContext(Dispatchers.IO) {
        activePort?.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
    }

    fun isConnected(): Boolean {
        return activePort != null && activePort!!.isOpen
    }

    suspend fun resetToEspBootloader() = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Serial port is not open")
        // ESP32 reset into bootloader:
        // EN = RTS (active low), IO0 = DTR (active low)
        port.dtr = false
        port.rts = true
        kotlinx.coroutines.delay(100)
        port.dtr = true
        port.rts = false
        kotlinx.coroutines.delay(100)
        port.dtr = false
        kotlinx.coroutines.delay(50)
    }

    suspend fun resetToK210Bootloader() = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Serial port is not open")
        // Kendryte K210 ISP mode:
        // BOOT = DTR (active low), RESET = RTS (active low)
        port.dtr = true
        port.rts = true
        kotlinx.coroutines.delay(120)
        port.rts = false
        kotlinx.coroutines.delay(120)
        port.dtr = false
        kotlinx.coroutines.delay(60)
    }

    suspend fun resetToRunMode() = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Serial port is not open")
        // Hard reset with boot pin high
        port.dtr = false
        port.rts = true
        kotlinx.coroutines.delay(100)
        port.rts = false
        kotlinx.coroutines.delay(150)
    }

    suspend fun write(data: ByteArray) = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Port not connected")
        port.write(data, 3000)
    }

    suspend fun writeSlipPacket(payload: ByteArray) = withContext(Dispatchers.IO) {
        val framed = SlipFraming.encode(payload)
        write(framed)
    }

    suspend fun read(buffer: ByteArray, timeoutMs: Int): Int = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Port not connected")
        return@withContext port.read(buffer, timeoutMs)
    }

    suspend fun readExact(count: Int, timeoutMs: Int): ByteArray = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Port not connected")
        val out = ByteArrayOutputStream(count)
        val temp = ByteArray(Math.min(count, 1024))
        val startTime = System.currentTimeMillis()

        while (out.size() < count) {
            if (System.currentTimeMillis() - startTime > timeoutMs) {
                throw IOException("Read timeout: requested $count bytes, got ${out.size()} bytes")
            }
            val remaining = count - out.size()
            val toRead = Math.min(temp.size, remaining)
            val readBytes = port.read(temp, 100)
            if (readBytes > 0) {
                out.write(temp, 0, readBytes)
            }
        }
        return@withContext out.toByteArray()
    }

    suspend fun readSlipPacket(timeoutMs: Int): ByteArray = withContext(Dispatchers.IO) {
        val port = activePort ?: throw IOException("Port not connected")
        val rawBuffer = ByteArrayOutputStream()
        val temp = ByteArray(512)
        val startTime = System.currentTimeMillis()
        var foundStart = false

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            val bytesRead = port.read(temp, 100)
            if (bytesRead > 0) {
                for (i in 0 until bytesRead) {
                    val b = temp[i]
                    if (b == SlipFraming.SLIP_END) {
                        if (!foundStart) {
                            foundStart = true
                            rawBuffer.reset()
                        } else if (rawBuffer.size() > 0) {
                            // Complete packet received
                            return@withContext SlipFraming.decode(rawBuffer.toByteArray())
                        }
                    } else if (foundStart) {
                        rawBuffer.write(b.toInt())
                    }
                }
            }
        }
        throw IOException("Timeout waiting for SLIP packet response (waited ${timeoutMs}ms)")
    }

    fun purgeBuffers() {
        try {
            val port = activePort ?: return
            val dummy = ByteArray(1024)
            while (port.read(dummy, 10) > 0) {
                // drain
            }
        } catch (e: Exception) {
            Log.w(TAG, "Purge buffers: ${e.message}")
        }
    }

    fun close() {
        try {
            activePort?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing port: ${e.message}")
        } finally {
            activePort = null
            activeDriver = null
        }
    }
}

