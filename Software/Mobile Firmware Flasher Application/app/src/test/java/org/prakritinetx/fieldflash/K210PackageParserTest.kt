package org.prakritinetx.fieldflash

import org.junit.Assert.assertEquals
import org.junit.Test
import org.prakritinetx.fieldflash.engine.k210.K210PackageParser
import java.io.File

class K210PackageParserTest {

    @Test
    fun testParseStandaloneBin() {
        val tempDir = File(System.getProperty("java.io.tmpdir"), "k210_test")
        tempDir.mkdirs()
        val dummyBin = File(tempDir, "app_update.bin")
        dummyBin.writeBytes(ByteArray(1024))

        val parser = K210PackageParser(tempDir)
        val tasks = parser.parse(dummyBin, 0x10000L)

        assertEquals(1, tasks.size)
        assertEquals("app_update.bin", tasks[0].name)
        assertEquals(0x10000L, tasks[0].offset)
        assertEquals(1024L, tasks[0].size)

        dummyBin.delete()
        tempDir.delete()
    }
}

