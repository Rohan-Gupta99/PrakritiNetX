package org.prakritinetx.fieldflash.core

object Constants {
    // Default Backend REST API URL (Configurable in Settings)
    const val DEFAULT_BASE_URL = "http://192.168.1.100:8080/"
    const val PREFS_NAME = "fieldflash_prefs"
    const val KEY_BACKEND_URL = "pref_backend_url"
    const val KEY_AUTO_WRITE_LOCATION = "pref_auto_write_location"

    // ESP32 Fixed Offsets
    const val ESP32_OFFSET_BOOTLOADER = 0x1000L
    const val ESP32_S3_OFFSET_BOOTLOADER = 0x0000L
    const val ESP32_OFFSET_PARTITION_TABLE = 0x8000L
    const val ESP32_OFFSET_APP = 0x10000L

    // K210 Default App Offset
    const val K210_OFFSET_APP = 0x000000L

    // Serial Baud Rates
    const val BAUD_BOOTLOADER_DEFAULT = 115200
    const val BAUD_FLASH_HIGH_SPEED = 921600
    const val BAUD_FLASH_ESP_SAFE = 460800
    const val BAUD_FLASH_K210_FAST = 1500000
    const val BAUD_APP_RUN = 115200

    // WorkManager Unique Worker Name
    const val WORKER_SYNC_LOCATIONS = "sync_queued_locations_worker"

    // Serial Protocol Timeouts (ms)
    const val TIMEOUT_SYNC_MS = 2500
    const val TIMEOUT_FLASH_BLOCK_MS = 5000
    const val TIMEOUT_VERIFICATION_MS = 6000
}

