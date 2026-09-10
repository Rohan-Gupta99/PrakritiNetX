package org.prakritinetx.fieldflash.engine.serial

sealed class SerialConnectionState {
    object Disconnected : SerialConnectionState()
    object Connecting : SerialConnectionState()
    data class Connected(
        val deviceName: String,
        val driverName: String,
        val vendorId: Int,
        val productId: Int,
        val portNumber: Int
    ) : SerialConnectionState()
    data class Error(val message: String, val cause: Throwable? = null) : SerialConnectionState()
}

