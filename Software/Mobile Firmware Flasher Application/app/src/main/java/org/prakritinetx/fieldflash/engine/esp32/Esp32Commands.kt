package org.prakritinetx.fieldflash.engine.esp32

object Esp32Commands {
    const val ESP_FLASH_BEGIN: Byte = 0x02
    const val ESP_FLASH_DATA: Byte = 0x03
    const val ESP_FLASH_END: Byte = 0x04
    const val ESP_MEM_BEGIN: Byte = 0x05
    const val ESP_MEM_END: Byte = 0x06
    const val ESP_MEM_DATA: Byte = 0x07
    const val ESP_SYNC: Byte = 0x08
    const val ESP_WRITE_REG: Byte = 0x09
    const val ESP_READ_REG: Byte = 0x0A
    const val ESP_SPI_SET_PARAMS: Byte = 0x0B
    const val ESP_SPI_ATTACH: Byte = 0x0D
    const val ESP_CHANGE_BAUDRATE: Byte = 0x0F
    const val ESP_SPI_FLASH_MD5: Byte = 0x13

    // Directions
    const val DIRECTION_REQ: Byte = 0x00
    const val DIRECTION_RESP: Byte = 0x01

    // Chip Magic Registers
    const val ESP32_REG_CHIP_REV = 0x3FF44000L
    const val ESP32_S3_REG_CHIP_REV = 0x60000000L
    const val ESP32_EFUSE_MAC_LO = 0x3FF5A004L
    const val ESP32_EFUSE_MAC_HI = 0x3FF5A008L
    const val ESP32_S3_EFUSE_MAC_LO = 0x60007044L
    const val ESP32_S3_EFUSE_MAC_HI = 0x60007048L

    // Sync sequence: 0x07, 0x07, 0x12, 0x20 followed by 32 bytes of 0x55
    fun getSyncPacket(): ByteArray {
        val payload = ByteArray(36)
        payload[0] = 0x07
        payload[1] = 0x07
        payload[2] = 0x12
        payload[3] = 0x20
        for (i in 4 until 36) {
            payload[i] = 0x55
        }
        return payload
    }
}

