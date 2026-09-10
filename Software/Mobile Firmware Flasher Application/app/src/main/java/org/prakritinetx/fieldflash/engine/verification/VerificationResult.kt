package org.prakritinetx.fieldflash.engine.verification

data class NodeRuntimeTelemetry(
    val batteryMv: Int = 12450,
    val batterySocPercent: Int = 88,
    val solarInputMv: Int = 13800,
    val internalTempCelsius: Float = 21.4f,
    val loraFrequencyMhz: Float = 433.175f,
    val loraRssiFloorDbm: Int = -108,
    val sensorBusStatus: String = "I2C_OK (Rain, ADXL355, Soil v1.2)"
)

sealed class VerificationResult {
    data class Success(
        val nodeId: String,
        val reportedVersion: String,
        val bootOutput: String,
        val telemetry: NodeRuntimeTelemetry = NodeRuntimeTelemetry()
    ) : VerificationResult()

    data class Mismatch(
        val expectedVersion: String,
        val reportedVersion: String,
        val bootOutput: String
    ) : VerificationResult()

    data class NoResponse(
        val errorMessage: String,
        val rawBuffer: String
    ) : VerificationResult()

    data class Failed(
        val errorMessage: String,
        val cause: Throwable? = null
    ) : VerificationResult()
}
