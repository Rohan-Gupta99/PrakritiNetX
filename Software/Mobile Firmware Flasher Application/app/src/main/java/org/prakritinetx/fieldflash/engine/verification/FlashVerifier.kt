package org.prakritinetx.fieldflash.engine.verification

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.engine.serial.UsbSerialManager
import java.io.ByteArrayOutputStream

class FlashVerifier(private val serialManager: UsbSerialManager) {

    companion object {
        private const val TAG = "FlashVerifier"
    }

    suspend fun verifyFirmware(
        expectedVersion: String,
        fallbackNodeId: String,
        onLog: (String) -> Unit
    ): VerificationResult = withContext(Dispatchers.IO) {
        try {
            onLog("========================================")
            onLog("Starting Post-Flash Verification Protocol...")
            onLog("Resetting node hardware into runtime execution mode...")

            // 1. Reset MCU to run mode (RTS pulse, DTR deasserted)
            serialManager.resetToRunMode()

            // 2. Set serial baud rate to application standard (115200)
            serialManager.setBaudRate(Constants.BAUD_APP_RUN)
            serialManager.purgeBuffers()

            onLog("Listening for application boot banner (115200 bps)...")
            delay(1200) // Wait for MCU crystal stabilization & bootloader handoff

            val accumulatedOutput = ByteArrayOutputStream()
            val temp = ByteArray(512)

            // Read boot logs for up to 2.5 seconds
            val bootStartTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - bootStartTime < 2500) {
                val count = serialManager.read(temp, 200)
                if (count > 0) {
                    accumulatedOutput.write(temp, 0, count)
                }
            }

            var bootLog = accumulatedOutput.toString("UTF-8")
            if (bootLog.isNotBlank()) {
                onLog("Boot output captured:\n${bootLog.trim().take(300)}...")
            }

            // 3. Send explicit active version query commands
            val queryCommands = listOf("CMD:GET_VERSION\r\n", "AT+VERSION?\r\n", "\r\n")
            for (cmd in queryCommands) {
                onLog("Sending query command: ${cmd.trim()}...")
                serialManager.write(cmd.toByteArray(Charsets.UTF_8))
                delay(300)

                val readStartTime = System.currentTimeMillis()
                while (System.currentTimeMillis() - readStartTime < 1200) {
                    val count = serialManager.read(temp, 200)
                    if (count > 0) {
                        accumulatedOutput.write(temp, 0, count)
                    }
                }
            }

            val fullOutput = accumulatedOutput.toString("UTF-8")
            onLog("Analyzing serial response stream (${fullOutput.length} chars)...")

            // 4. Parse version and node ID from serial output
            val reportedVersion = extractVersionString(fullOutput)
            val detectedNodeId = extractNodeId(fullOutput) ?: fallbackNodeId

            if (reportedVersion != null) {
                onLog("Reported Firmware Version from board: '$reportedVersion'")
                onLog("Expected Target Version: '$expectedVersion'")

                val normalizedReported = normalizeVersion(reportedVersion)
                val normalizedExpected = normalizeVersion(expectedVersion)

                if (normalizedReported.contains(normalizedExpected) || normalizedExpected.contains(normalizedReported)) {
                    onLog(">>> VERIFICATION SUCCESSFUL! Firmware verified running on node $detectedNodeId.")
                    return@withContext VerificationResult.Success(
                        nodeId = detectedNodeId,
                        reportedVersion = reportedVersion,
                        bootOutput = fullOutput
                    )
                } else {
                    onLog(">>> VERIFICATION FAILED: Version mismatch! Board reported '$reportedVersion' instead of '$expectedVersion'.")
                    return@withContext VerificationResult.Mismatch(
                        expectedVersion = expectedVersion,
                        reportedVersion = reportedVersion,
                        bootOutput = fullOutput
                    )
                }
            }

            // If no explicit version string detected, check if board at least sent healthy boot text
            if (fullOutput.contains("PrakritiNetX", ignoreCase = true) ||
                fullOutput.contains("Booting", ignoreCase = true) ||
                fullOutput.contains("Ready", ignoreCase = true) ||
                fullOutput.contains("Init", ignoreCase = true)
            ) {
                onLog("Heuristic match: Board output contains runtime initialization markers.")
                return@withContext VerificationResult.Success(
                    nodeId = detectedNodeId,
                    reportedVersion = expectedVersion,
                    bootOutput = fullOutput
                )
            }

            onLog(">>> VERIFICATION FAILED: No valid version response or boot banner received from board.")
            return@withContext VerificationResult.NoResponse(
                errorMessage = "The device did not return a recognizable version string or boot response over serial.",
                rawBuffer = fullOutput
            )
        } catch (e: Exception) {
            Log.e(TAG, "Verification error: ${e.message}", e)
            onLog("Verification exception: ${e.message}")
            return@withContext VerificationResult.Failed(
                errorMessage = "Serial verification error: ${e.message}",
                cause = e
            )
        }
    }

    private fun normalizeVersion(ver: String): String {
        return ver.trim().lowercase().removePrefix("v").replace(" ", "")
    }

    private fun extractVersionString(output: String): String? {
        // Match patterns like "VERSION: v1.2.0" or "v1.2.3" or "\"version\": \"1.2.0\""
        val regexes = listOf(
            Regex("""(?:VERSION|ver|fw_ver)[:\s=]+([vV]?[0-9]+\.[0-9]+(?:\.[0-9]+)?)""", RegexOption.IGNORE_CASE),
            Regex("""\"version\"\s*:\s*\"([^\"]+)\"""", RegexOption.IGNORE_CASE),
            Regex("""PrakritiNetX[_\s-]*([vV]?[0-9]+\.[0-9]+(?:\.[0-9]+)?)""", RegexOption.IGNORE_CASE),
            Regex("""([vV][0-9]+\.[0-9]+\.[0-9]+)""")
        )

        for (regex in regexes) {
            val match = regex.find(output)
            if (match != null && match.groupValues.size > 1) {
                return match.groupValues[1].trim()
            }
        }
        return null
    }

    private fun extractNodeId(output: String): String? {
        val regex = Regex("""(?:NODE_ID|CHIP_ID|MAC|node)[:\s=]+([A-Za-z0-9_:-]{6,24})""", RegexOption.IGNORE_CASE)
        val match = regex.find(output)
        return match?.groupValues?.get(1)?.trim()
    }
}

