package org.prakritinetx.fieldflash.engine.serial

import java.io.ByteArrayOutputStream

object SlipFraming {
    const val SLIP_END: Byte = 0xC0.toByte()
    const val SLIP_ESC: Byte = 0xDB.toByte()
    const val SLIP_ESC_END: Byte = 0xDC.toByte()
    const val SLIP_ESC_ESC: Byte = 0xDD.toByte()

    fun encode(data: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(data.size + 16)
        out.write(SLIP_END.toInt())
        for (b in data) {
            when (b) {
                SLIP_END -> {
                    out.write(SLIP_ESC.toInt())
                    out.write(SLIP_ESC_END.toInt())
                }
                SLIP_ESC -> {
                    out.write(SLIP_ESC.toInt())
                    out.write(SLIP_ESC_ESC.toInt())
                }
                else -> out.write(b.toInt())
            }
        }
        out.write(SLIP_END.toInt())
        return out.toByteArray()
    }

    fun decode(framedData: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(framedData.size)
        var inEscape = false

        for (b in framedData) {
            if (b == SLIP_END) {
                // End delimiter
                continue
            }
            if (inEscape) {
                if (b == SLIP_ESC_END) {
                    out.write(SLIP_END.toInt())
                } else if (b == SLIP_ESC_ESC) {
                    out.write(SLIP_ESC.toInt())
                } else {
                    out.write(b.toInt())
                }
                inEscape = false
            } else {
                if (b == SLIP_ESC) {
                    inEscape = true
                } else {
                    out.write(b.toInt())
                }
            }
        }
        return out.toByteArray()
    }
}

