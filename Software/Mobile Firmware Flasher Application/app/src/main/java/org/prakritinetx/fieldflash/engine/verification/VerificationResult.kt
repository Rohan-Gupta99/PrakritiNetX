package org.prakritinetx.fieldflash.engine.verification

sealed class VerificationResult {
    data class Success(
        val nodeId: String,
        val reportedVersion: String,
        val bootOutput: String
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

