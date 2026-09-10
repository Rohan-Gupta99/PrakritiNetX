package org.prakritinetx.fieldflash.engine.k210

object K210Commands {
    const val ISP_CMD_GREETING: Byte = 0xC1.toByte()
    const val ISP_CMD_NOP: Byte = 0xC2.toByte()
    const val ISP_CMD_CHANGE_BAUD: Byte = 0xC3.toByte()
    const val ISP_CMD_FLASH_INIT: Byte = 0xC4.toByte()
    const val ISP_CMD_FLASH_WRITE: Byte = 0xC5.toByte()
    const val ISP_CMD_REBOOT: Byte = 0xC8.toByte()
    const val ISP_CMD_READ_CHIP_ID: Byte = 0xC9.toByte()

    const val ISP_RESP_OK: Byte = 0x00
    const val ISP_RESP_FAIL: Byte = 0xFF.toByte()

    const val K210_DEFAULT_FLASH_CHUNK_SIZE = 4096
}

