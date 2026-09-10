package org.prakritinetx.fieldflash.engine.esp32

import org.prakritinetx.fieldflash.core.Constants
import java.io.File

data class FlashBlockTask(
    val name: String,
    val offset: Long,
    val file: File,
    val size: Long
)

class Esp32FlashPlan(
    val isS3: Boolean = false,
    val tasks: List<FlashBlockTask>
) {
    val totalBytes: Long = tasks.sumOf { it.size }

    companion object {
        fun createDefault(
            bootloaderFile: File,
            partitionFile: File,
            appFile: File,
            isS3: Boolean = false
        ): Esp32FlashPlan {
            val bootloaderOffset = if (isS3) Constants.ESP32_S3_OFFSET_BOOTLOADER else Constants.ESP32_OFFSET_BOOTLOADER
            val tasks = listOf(
                FlashBlockTask("bootloader.bin", bootloaderOffset, bootloaderFile, bootloaderFile.length()),
                FlashBlockTask("partition-table.bin", Constants.ESP32_OFFSET_PARTITION_TABLE, partitionFile, partitionFile.length()),
                FlashBlockTask("app.bin", Constants.ESP32_OFFSET_APP, appFile, appFile.length())
            )
            return Esp32FlashPlan(isS3, tasks)
        }
    }
}

