package org.prakritinetx.fieldflash

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import org.prakritinetx.fieldflash.engine.serial.SlipFraming

class SlipFramingTest {

    @Test
    fun testSimpleFraming() {
        val original = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val encoded = SlipFraming.encode(original)

        assertEquals(SlipFraming.SLIP_END, encoded[0])
        assertEquals(SlipFraming.SLIP_END, encoded[encoded.size - 1])

        val decoded = SlipFraming.decode(encoded)
        assertArrayEquals(original, decoded)
    }

    @Test
    fun testEscapeSequences() {
        // Contains SLIP_END (0xC0) and SLIP_ESC (0xDB)
        val original = byteArrayOf(0x01, 0xC0.toByte(), 0xDB.toByte(), 0x05)
        val encoded = SlipFraming.encode(original)

        // Encoded must not have raw 0xC0 or 0xDB in the body
        val body = encoded.sliceArray(1 until encoded.size - 1)
        for (b in body) {
            assert(b != SlipFraming.SLIP_END)
        }

        val decoded = SlipFraming.decode(encoded)
        assertArrayEquals(original, decoded)
    }
}

