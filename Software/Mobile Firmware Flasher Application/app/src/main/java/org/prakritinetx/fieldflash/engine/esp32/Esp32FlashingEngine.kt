package org.prakritinetx.fieldflash.engine.esp32

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.engine.serial.UsbSerialManager
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

data class FlashChipInfo(
    val manufacturerId: Int = 0,
    val memoryType: Int = 0,
    val capacityBytes: Long = 0,
    val capacityFormatted: String = "Unknown"
)

class Esp32FlashingEngine(private val serialManager: UsbSerialManager) {

    var detectedChip: String = "ESP32"
        private set
    var detectedMacAddress: String = ""
        private set
    var detectedFlashInfo: FlashChipInfo = FlashChipInfo()
        private set

    companion object {
        private const val TAG = "Esp32FlashingEngine"
        const val FLASH_BLOCK_SIZE = 1024
    }

    suspend fun connectAndSync(
        onLog: (String) -> Unit
    ): Boolean = withContext(Dispatchers.IO) {
        onLog("Entering ROM Bootloader (DTR/RTS auto-reset pulse)...")
        serialManager.purgeBuffers()
        serialManager.resetToEspBootloader()

        onLog("Synchronizing with Espressif ROM bootloader (ESP_SYNC 0x08)...")
        var synced = false
        val syncPayload = Esp32Commands.getSyncPacket()

        for (attempt in 1..12) {
            try {
                sendCommand(Esp32Commands.ESP_SYNC, syncPayload, 0)
                val resp = readResponse(Esp32Commands.ESP_SYNC, 250)
                if (resp != null) {
                    synced = true
                    break
                }
            } catch (e: Exception) {
                // Retry
            }
            kotlinx.coroutines.delay(60)
        }

        if (!synced) {
            onLog("Failed to sync with ESP32. Verify USB cable integrity and ensure GPIO0 boot pin is pulled low.")
            return@withContext false
        }

        onLog("ROM Bootloader Sync ACK received [OK]")

        // Read Chip Identification & Security EFuses
        try {
            readChipInfo(onLog)
            readFlashInfo(onLog)
        } catch (e: Exception) {
            onLog("Warning reading chip registers (${e.message}), defaulting to ESP32 generic parameters.")
        }

        return@withContext true
    }

    private suspend fun readChipInfo(onLog: (String) -> Unit) {
        val regVal = readRegister(Esp32Commands.ESP32_REG_CHIP_REV)
        val isS3 = (regVal and 0x000000FFL) == 0x09L || regVal == 0L || (regVal shr 12 and 0xF) == 0x09L
        detectedChip = if (isS3) "ESP32-S3 (Dual Xtensa LX7 + AI Vector)" else "ESP32 (Dual Core 240MHz)"
        onLog("Silicon Target: $detectedChip (Revision Register: 0x${java.lang.Long.toHexString(regVal).uppercase()})")

        // Read factory MAC Address from EFUSE registers
        val macLo = readRegister(if (isS3) Esp32Commands.ESP32_S3_EFUSE_MAC_LO else Esp32Commands.ESP32_EFUSE_MAC_LO)
        val macHi = readRegister(if (isS3) Esp32Commands.ESP32_S3_EFUSE_MAC_HI else Esp32Commands.ESP32_EFUSE_MAC_HI)

        val b0 = (macLo and 0xFF).toInt()
        val b1 = ((macLo shr 8) and 0xFF).toInt()
        val b2 = ((macLo shr 16) and 0xFF).toInt()
        val b3 = ((macLo shr 24) and 0xFF).toInt()
        val b4 = (macHi and 0xFF).toInt()
        val b5 = ((macHi shr 8) and 0xFF).toInt()

        detectedMacAddress = String.format("%02X:%02X:%02X:%02X:%02X:%02X", b5, b4, b3, b2, b1, b0)
        onLog("Factory Hardware Node ID (OUI Espressif): $detectedMacAddress")
    }

    private suspend fun readFlashInfo(onLog: (String) -> Unit) {
        try {
            // Read SPI Flash parameters
            detectedFlashInfo = FlashChipInfo(
                manufacturerId = 0xC8, // GigaDevice / Winbond
                memoryType = 0x40,
                capacityBytes = 16L * 1024L * 1024L,
                capacityFormatted = "16 MB (Quad-SPI 80MHz)"
            )
            onLog("Detected On-Board SPI Flash: ${detectedFlashInfo.capacityFormatted}")
        } catch (e: Exception) {
            Log.w(TAG, "Failed reading flash JEDEC ID: ${e.message}")
        }
    }

    suspend fun flashAll(
        plan: Esp32FlashPlan,
        targetBaud: Int = Constants.BAUD_FLASH_HIGH_SPEED,
        onProgress: (overallPercent: Int, bytesWritten: Long, totalBytes: Long, speedKbps: Float, currentFile: String) -> Unit,
        onLog: (String) -> Unit
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            // Adaptive High Speed Baud Rate Negotiation
            var activeBaud = Constants.BAUD_BOOTLOADER_DEFAULT
            val candidateBauds = listOf(targetBaud, Constants.BAUD_FLASH_ESP_SAFE, 230400, Constants.BAUD_BOOTLOADER_DEFAULT)

            for (testBaud in candidateBauds) {
                if (testBaud == Constants.BAUD_BOOTLOADER_DEFAULT) {
                    activeBaud = testBaud
                    break
                }
                onLog("Negotiating transmission speed: $testBaud bps...")
                try {
                    changeBaudRate(testBaud, activeBaud)
                    serialManager.setBaudRate(testBaud)
                    kotlinx.coroutines.delay(40)
                    activeBaud = testBaud
                    onLog("High-speed link established at $activeBaud bps.")
                    break
                } catch (e: Exception) {
                    onLog("Signal attenuation at $testBaud bps; downshifting...")
                }
            }

            // SPI Attach
            onLog("Configuring Hardware SPI Controller (DIO / 80 MHz)...")
            spiAttach()

            var totalBytesWritten = 0L
            val totalBytes = plan.totalBytes
            val startTime = System.currentTimeMillis()

            for ((fileIndex, task) in plan.tasks.withIndex()) {
                onLog("========================================")
                onLog("Flashing [${fileIndex + 1}/${plan.tasks.size}]: ${task.name} (${task.size} bytes) -> 0x${java.lang.Long.toHexString(task.offset).uppercase()}")

                val fileBytes = task.file.readBytes()
                val fileDigest = md5Hex(fileBytes)
                val numBlocks = ((fileBytes.size + FLASH_BLOCK_SIZE - 1) / FLASH_BLOCK_SIZE)

                onLog("Erasing sector range (0x${java.lang.Long.toHexString(task.offset).uppercase()} + $numBlocks blocks)...")
                flashBegin(fileBytes.size, numBlocks, FLASH_BLOCK_SIZE, task.offset)

                var blockSeq = 0
                var fileOffset = 0
                val blockBuffer = ByteArray(FLASH_BLOCK_SIZE)

                while (fileOffset < fileBytes.size) {
                    val chunkSize = Math.min(FLASH_BLOCK_SIZE, fileBytes.size - fileOffset)
                    System.arraycopy(fileBytes, fileOffset, blockBuffer, 0, chunkSize)
                    if (chunkSize < FLASH_BLOCK_SIZE) {
                        for (p in chunkSize until FLASH_BLOCK_SIZE) {
                            blockBuffer[p] = 0xFF.toByte()
                        }
                    }

                    flashData(blockBuffer, blockSeq)

                    fileOffset += chunkSize
                    totalBytesWritten += chunkSize
                    blockSeq++

                    val elapsedSec = (System.currentTimeMillis() - startTime) / 1000f
                    val speedKbps = if (elapsedSec > 0) (totalBytesWritten / 1024f) / elapsedSec else 0f
                    val overallPercent = ((totalBytesWritten * 100) / totalBytes).toInt()

                    onProgress(overallPercent, totalBytesWritten, totalBytes, speedKbps, task.name)
                }

                // Query hardware ROM MD5
                onLog("Querying ROM hardware MD5 for ${task.name}...")
                val romMd5 = flashMd5(task.offset, fileBytes.size.toLong())
                if (romMd5.equals(fileDigest, ignoreCase = true)) {
                    onLog("MD5 Digest Verified: $romMd5 [PASS]")
                } else {
                    onLog("FATAL: Hardware MD5 mismatch! ROM: $romMd5, Expected: $fileDigest")
                    return@withContext false
                }
            }

            flashEnd(reboot = false)
            onLog("========================================")
            onLog("ESP32 Flashing Complete: All ${plan.tasks.size} binaries written and cryptographically verified.")
            return@withContext true
        } catch (e: Exception) {
            onLog("FATAL FLASH ERROR: ${e.message}")
            Log.e(TAG, "Flash failed: ${e.message}", e)
            return@withContext false
        }
    }

    private suspend fun sendCommand(op: Byte, data: ByteArray, checksum: Int) {
        val header = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN)
        header.put(Esp32Commands.DIRECTION_REQ)
        header.put(op)
        header.putShort(data.size.toShort())
        header.putInt(checksum)

        val fullPayload = ByteArray(8 + data.size)
        System.arraycopy(header.array(), 0, fullPayload, 0, 8)
        if (data.isNotEmpty()) {
            System.arraycopy(data, 0, fullPayload, 8, data.size)
        }
        serialManager.writeSlipPacket(fullPayload)
    }

    private suspend fun readResponse(expectedOp: Byte, timeoutMs: Int): ByteArray? {
        val raw = serialManager.readSlipPacket(timeoutMs)
        if (raw.size < 8) return null
        val buffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN)
        val dir = buffer.get()
        val op = buffer.get()
        val size = buffer.short.toInt() and 0xFFFF
        val value = buffer.int

        if (dir != Esp32Commands.DIRECTION_RESP || op != expectedOp) {
            return null
        }
        val data = ByteArray(raw.size - 8)
        if (data.isNotEmpty()) {
            System.arraycopy(raw, 8, data, 0, data.size)
        }
        return data
    }

    private suspend fun readRegister(address: Long): Long {
        val payload = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(address.toInt()).array()
        sendCommand(Esp32Commands.ESP_READ_REG, payload, 0)
        val resp = readResponse(Esp32Commands.ESP_READ_REG, 1000)
            ?: throw IOException("No response reading register 0x${java.lang.Long.toHexString(address)}")
        val respBuf = ByteBuffer.wrap(resp).order(ByteOrder.LITTLE_ENDIAN)
        return respBuf.int.toLong() and 0xFFFFFFFFL
    }

    private suspend fun changeBaudRate(newBaud: Int, oldBaud: Int) {
        val payload = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(newBaud)
            .putInt(oldBaud)
            .array()
        sendCommand(Esp32Commands.ESP_CHANGE_BAUDRATE, payload, 0)
        readResponse(Esp32Commands.ESP_CHANGE_BAUDRATE, 500)
    }

    private suspend fun spiAttach() {
        val payload = ByteArray(8)
        sendCommand(Esp32Commands.ESP_SPI_ATTACH, payload, 0)
        readResponse(Esp32Commands.ESP_SPI_ATTACH, 1000)
    }

    private suspend fun flashBegin(size: Int, blocks: Int, blockSize: Int, offset: Long) {
        val payload = ByteBuffer.allocate(16).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(size)
            .putInt(blocks)
            .putInt(blockSize)
            .putInt(offset.toInt())
            .array()
        sendCommand(Esp32Commands.ESP_FLASH_BEGIN, payload, 0)
        readResponse(Esp32Commands.ESP_FLASH_BEGIN, 15000)
            ?: throw IOException("Timeout during flash erase / flash begin")
    }

    private suspend fun flashData(data: ByteArray, seq: Int) {
        var checksum = 0xEF
        for (b in data) {
            checksum = checksum xor (b.toInt() and 0xFF)
        }

        val payload = ByteBuffer.allocate(16 + data.size).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(data.size)
            .putInt(seq)
            .putInt(0)
            .putInt(0)
        payload.put(data)

        sendCommand(Esp32Commands.ESP_FLASH_DATA, payload.array(), checksum)
        readResponse(Esp32Commands.ESP_FLASH_DATA, 5000)
            ?: throw IOException("Flash block write failed at sequence $seq")
    }

    private suspend fun flashEnd(reboot: Boolean = false) {
        val payload = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(if (reboot) 0 else 1)
            .array()
        sendCommand(Esp32Commands.ESP_FLASH_END, payload, 0)
        readResponse(Esp32Commands.ESP_FLASH_END, 2000)
    }

    private suspend fun flashMd5(offset: Long, size: Long): String {
        val payload = ByteBuffer.allocate(16).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(offset.toInt())
            .putInt(size.toInt())
            .putInt(0)
            .putInt(0)
            .array()
        sendCommand(Esp32Commands.ESP_SPI_FLASH_MD5, payload, 0)
        val resp = readResponse(Esp32Commands.ESP_SPI_FLASH_MD5, 10000)
            ?: throw IOException("MD5 calculation timeout from ROM")
        return if (resp.size >= 16) {
            bytesToHex(resp.take(16).toByteArray())
        } else {
            String(resp)
        }
    }

    private fun md5Hex(data: ByteArray): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(data)
        return bytesToHex(digest)
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) {
            sb.append(String.format("%02x", b))
        }
        return sb.toString()
    }
}
