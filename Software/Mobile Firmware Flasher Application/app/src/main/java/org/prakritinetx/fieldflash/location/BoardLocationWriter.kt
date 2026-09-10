package org.prakritinetx.fieldflash.location

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.engine.serial.UsbSerialManager
import java.io.ByteArrayOutputStream

class BoardLocationWriter(private val serialManager: UsbSerialManager) {

    suspend fun writeLocationToBoard(
        fix: GpsLocationFix,
        onLog: (String) -> Unit
    ): Resource<String> = withContext(Dispatchers.IO) {
        try {
            if (!serialManager.isConnected()) {
                return@withContext Resource.Error("Board is not connected via USB-serial.")
            }

            serialManager.setBaudRate(Constants.BAUD_APP_RUN)
            serialManager.purgeBuffers()

            val altStr = fix.altitude?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "0.0"
            val accStr = fix.accuracy?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "0.0"

            // Command format: CONFIG:LOC:<lat>,<lon>,<alt>,<accuracy>,<timestamp>\r\n
            val cmd = String.format(
                java.util.Locale.US,
                "CONFIG:LOC:%.6f,%.6f,%s,%s,%d\r\n",
                fix.latitude,
                fix.longitude,
                altStr,
                accStr,
                fix.timestamp
            )

            onLog("Sending location coordinates to node flash/EEPROM...")
            onLog("Command: ${cmd.trim()}")

            serialManager.write(cmd.toByteArray(Charsets.UTF_8))
            delay(500)

            // Read response
            val buffer = ByteArray(256)
            val accumulated = ByteArrayOutputStream()
            val start = System.currentTimeMillis()

            while (System.currentTimeMillis() - start < 2000) {
                val read = serialManager.read(buffer, 200)
                if (read > 0) {
                    accumulated.write(buffer, 0, read)
                }
            }

            val responseStr = accumulated.toString("UTF-8").trim()
            onLog("Board response: $responseStr")

            if (responseStr.contains("OK", ignoreCase = true) ||
                responseStr.contains("SAVED", ignoreCase = true) ||
                responseStr.contains("SUCCESS", ignoreCase = true)
            ) {
                onLog(">>> Location successfully written and persisted in board NVS/EEPROM!")
                return@withContext Resource.Success("Coordinates persisted on node flash.")
            } else {
                onLog("Warning: Sent location, but board did not confirm with OK/SAVED (Response: '$responseStr')")
                return@withContext Resource.Success("Coordinates sent to board (Unconfirmed ACK).")
            }
        } catch (e: Exception) {
            onLog("Error writing location to board: ${e.message}")
            return@withContext Resource.Error("Failed to write to board: ${e.message}", e)
        }
    }
}

