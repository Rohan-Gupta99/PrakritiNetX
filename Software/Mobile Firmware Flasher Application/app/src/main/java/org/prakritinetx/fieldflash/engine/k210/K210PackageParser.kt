package org.prakritinetx.fieldflash.engine.k210

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipFile

data class K210FlashTask(
    val name: String,
    val offset: Long,
    val file: File,
    val size: Long,
    val sha256Prefix: Boolean = false
)

data class KfpkgManifest(
    @SerializedName("version") val version: String = "0.1.0",
    @SerializedName("files") val files: List<KfpkgFileEntry> = emptyList()
)

data class KfpkgFileEntry(
    @SerializedName("address") val address: Long,
    @SerializedName("bin") val bin: String,
    @SerializedName("sha256Prefix") val sha256Prefix: Boolean = false
)

class K210PackageParser(private val cacheDir: File) {

    private val gson = Gson()

    /**
     * Parses either a .kfpkg bundled archive or a standalone .bin file.
     */
    fun parse(packageFile: File, standaloneOffset: Long = 0L): List<K210FlashTask> {
        val tasks = mutableListOf<K210FlashTask>()
        if (packageFile.name.endsWith(".kfpkg", ignoreCase = true)) {
            val extractDir = File(cacheDir, "kfpkg_extracted_${System.currentTimeMillis()}").apply { mkdirs() }
            val zip = ZipFile(packageFile)
            val manifestEntry = zip.getEntry("flash-list.json")
                ?: throw IllegalArgumentException(".kfpkg archive missing flash-list.json manifest")

            val manifestContent = zip.getInputStream(manifestEntry).bufferedReader().use { it.readText() }
            val manifest = gson.fromJson(manifestContent, KfpkgManifest::class.java)

            for (entry in manifest.files) {
                val binEntry = zip.getEntry(entry.bin)
                    ?: throw IllegalArgumentException("Manifest refers to ${entry.bin} but not found in zip")
                val destFile = File(extractDir, entry.bin)
                zip.getInputStream(binEntry).use { input ->
                    FileOutputStream(destFile).use { output ->
                        input.copyTo(output)
                    }
                }
                tasks.add(
                    K210FlashTask(
                        name = entry.bin,
                        offset = entry.address,
                        file = destFile,
                        size = destFile.length(),
                        sha256Prefix = entry.sha256Prefix
                    )
                )
            }
            zip.close()
        } else {
            // Standalone .bin application update
            tasks.add(
                K210FlashTask(
                    name = packageFile.name,
                    offset = standaloneOffset,
                    file = packageFile,
                    size = packageFile.length(),
                    sha256Prefix = false
                )
            )
        }
        return tasks
    }
}

