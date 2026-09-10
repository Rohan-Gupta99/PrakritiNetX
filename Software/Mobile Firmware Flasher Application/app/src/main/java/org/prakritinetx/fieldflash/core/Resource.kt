package org.prakritinetx.fieldflash.core

sealed class Resource<out T> {
    data class Success<out T>(val data: T) : Resource<T>()
    data class Error(val message: String, val cause: Throwable? = null) : Resource<Nothing>()
    data class Loading(val progressMessage: String? = null, val percent: Int = 0) : Resource<Nothing>()
    object Idle : Resource<Nothing>()
}

