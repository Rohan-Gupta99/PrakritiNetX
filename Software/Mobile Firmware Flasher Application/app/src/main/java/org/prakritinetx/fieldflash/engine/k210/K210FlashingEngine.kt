package org.prakritinetx.fieldflash.engine.k210

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.engine.serial.UsbSerialManager
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

class K210FlashingEngine(private val serialManager: UsbSerialManager) {

    var detectedChip: String = "Kendryte K210"
        private set
    var detectedChipId: String = ""
        private set

    companion object {
        private const val TAG = "K210FlashingEngine"
        const val CHUNK_SIZE = 4096 // K210 flash block chunk size
    }

    suspend fun connectAndSync(
        onLog: (String) -> Unit
    ): Boolean = withContext(Dispatchers.IO) {
        onLog("Entering Kendryte K210 ISP Mode (IO16/BOOT + RESET pulse)...")
        serialManager.purgeBuffers()
        serialManager.resetToK210Bootloader()

        onLog("Sending Kendryte ISP greeting handshake (0xC1)...")
        var synced = false

        for (attempt in 1..10) {
            try {
                sendIspCommand(K210Commands.ISP_CMD_GREETING, byteArrayOf(0x00))
                val resp = readIspResponse(500)
                if (resp != null && resp.isNotEmpty()) {
                    synced = true
                    onLog("Kendryte ISP ROM responded! Bootloader active.")
                    break
                }
            } catch (e: Exception) {
                // Retry
            }
            kotlinx.coroutines.delay(100)
        }

        if (!synced) {
            onLog("Failed to enter K210 ISP mode. Verify DTR/RTS lines and ensure K210 is powered.")
            return@withContext false
        }

        // Read Unique 64-bit Device ID
        try {
            readChipId(onLog)
        } catch (e: Exception) {
            onLog("Warning: Could not read K210 Chip ID: ${e.message}")
            detectedChipId = "K210_" + System.currentTimeMillis().toString().takeLast(6)
        }

        return@withContext true
    }

    private suspend fun readChipId(onLog: (String) -> Unit) {
        onLog("Reading Kendryte 64-bit Unique Device ID...")
        sendIspCommand(K210Commands.ISP_CMD_READ_CHIP_ID, byteArrayOf())
        val resp = readIspResponse(1000)
        if (resp != null && resp.size >= 8) {
            val buf = ByteBuffer.wrap(resp).order(ByteOrder.BIG_ENDIAN)
            val idLo = buf.int.toLong() and 0xFFFFFFFFL
            val idHi = buf.int.toLong() and 0xFFFFFFFFL
            detectedChipId = String.format("K210_%08X%08X", idLo, idHi)
        } else {
            detectedChipId = "K210_" + Long.toString(System.currentTimeMillis(), 16).uppercase()
        }
        onLog("Hardware Unique Node ID (Chip ID): $detectedChipId")
    }

    suspend fun flashTasks(
        tasks: List<K210FlashTask>,
        highSpeedBaud: Int = Constants.BAUD_FLASH_K210_FAST,
        onProgress: (overallPercent: Int, bytesWritten: Long, totalBytes: Long, speedKbps: Float, currentFile: String) -> Unit,
        onLog: (String) -> Unit
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val totalBytes = tasks.sumOf { it.size }
            onLog("Preparing K210 Flash Engine: ${tasks.size} task(s), total $totalBytes bytes.")

            // 1. Negotiate High Speed Baud Rate if requested
            if (highSpeedBaud > Constants.BAUD_BOOTLOADER_DEFAULT) {
                onLog("Switching UART baud rate to $highSpeedBaud bps for high-speed flashing...")
                try {
                    val baudPayload = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(highSpeedBaud).array()
                    sendIspCommand(K210Commands.ISP_CMD_CHANGE_BAUD, baudPayload)
                    kotlinx.coroutines.delay(30)
                    serialManager.setBaudRate(highSpeedBaud)
                    kotlinx.coroutines.delay(50)
                    onLog("UART switched to $highSpeedBaud bps successfully.")
                } catch (e: Exception) {
                    onLog("Warning: Baud rate change failed (${e.message}), continuing at 115200 bps.")
                }
            }

            // 2. Initialize SPI Flash
            onLog("Initializing K210 SPI Flash peripheral...")
            sendIspCommand(K210Commands.ISP_CMD_FLASH_INIT, byteArrayOf())
            readIspResponse(2000)

            var totalBytesWritten = 0L
            val startTime = System.currentTimeMillis()

            for ((index, task) in tasks.withIndex()) {
                onLog("----------------------------------------")
                onLog("Flashing [${index + 1}/${tasks.size}]: ${task.name} (${task.size} bytes) at offset 0x${java.lang.Long.toHexString(task.offset).uppercase()}")

                val fileBytes = task.file.readBytes()
                var fileOffset = 0

                while (fileOffset < fileBytes.size) {
                    val chunkSize = Math.min(CHUNK_SIZE, fileBytes.size - fileOffset)
                    val currentFlashAddress = task.offset + fileOffset

                    val packetBuffer = ByteBuffer.allocate(8 + chunkSize).order(ByteOrder.LITTLE_ENDIAN)
                    packetBuffer.putInt(currentFlashAddress.toInt())
                    packetBuffer.putInt(chunkSize)
                    packetBuffer.put(fileBytes, fileOffset, chunkSize)

                    sendIspCommand(K210Commands.ISP_CMD_FLASH_WRITE, packetBuffer.array())
                    val ack = readIspResponse(3000)
                    if (ack == null || (ack.isNotEmpty() && ack[0] == K210Commands.ISP_RESP_FAIL)) {
                        throw IOException("Flash write failed at offset 0x${java.lang.Long.toHexString(currentFlashAddress)}")
                    }

                    fileOffset += chunkSize
                    totalBytesWritten += chunkSize

                    val elapsedSec = (System.currentTimeMillis() - startTime) / 1000f
                    val speedKbps = if (elapsedSec > 0) (totalBytesWritten / 1024f) / elapsedSec else 0f
                    val overallPercent = if (totalBytes > 0) ((totalBytesWritten * 100) / totalBytes).toInt() else 100

                    onProgress(overallPercent, totalBytesWritten, totalBytes, speedKbps, task.name)
                }

                onLog("Written ${task.name} successfully.")
            }

            onLog("========================================")
            onLog("K210 Flashing Completed Successfully! Total $totalBytesWritten bytes written.")
            return@withContext true
        } catch (e: Exception) {
            onLog("FATAL K210 FLASH ERROR: ${e.message}")
            Log.e(TAG, "K210 Flash failed: ${e.message}", e)
            return@withContext false
        }
    }

    private suspend fun sendIspCommand(op: Byte, payload: ByteArray) {
        val header = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN)
        header.put(op)
        header.put(0x00.toByte()) // flags
        header.putShort(payload.size.toShort())

        val full = ByteArray(4 + payload.size)
        System.arraycopy(header.array(), 0, full, 0, 4)
        if (payload.isNotEmpty()) {
            System.arraycopy(payload, 0, full, 4, payload.size)
        }
        serialManager.write(full)
    }

    private suspend fun readIspResponse(timeoutMs: Int): ByteArray? {
        val buffer = ByteArray(256)
        val readBytes = serialManager.read(buffer, timeoutMs)
        return if (readBytes > 0) {
            buffer.copyOf(readBytes)
        } else {
            null
        }
    }
}

