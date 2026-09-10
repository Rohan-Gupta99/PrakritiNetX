package org.prakritinetx.fieldflash

import org.junit.Assert.assertEquals
import org.junit.Test
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.engine.esp32.Esp32Commands

class Esp32CommandTest {

    @Test
    fun testSyncPacketLayout() {
        val syncPacket = Esp32Commands.getSyncPacket()
        assertEquals(36, syncPacket.size)
        assertEquals(0x07, syncPacket[0].toInt())
        assertEquals(0x07, syncPacket[1].toInt())
        assertEquals(0x12, syncPacket[2].toInt())
        assertEquals(0x20, syncPacket[3].toInt())
        for (i in 4 until 36) {
            assertEquals(0x55, syncPacket[i].toInt())
        }
    }

    @Test
    fun testDefaultFlashOffsets() {
        assertEquals(0x1000L, Constants.ESP32_OFFSET_BOOTLOADER)
        assertEquals(0x0000L, Constants.ESP32_S3_OFFSET_BOOTLOADER)
        assertEquals(0x8000L, Constants.ESP32_OFFSET_PARTITION_TABLE)
        assertEquals(0x10000L, Constants.ESP32_OFFSET_APP)
    }
}

