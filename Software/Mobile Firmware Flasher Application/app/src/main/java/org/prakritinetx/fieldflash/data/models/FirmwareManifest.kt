package org.prakritinetx.fieldflash.data.models

import com.google.gson.annotations.SerializedName

data class FirmwareManifest(
    @SerializedName("network") val network: String = "PrakritiNetX",
    @SerializedName("manifest_version") val manifestVersion: String = "1.0",
    @SerializedName("updated_at") val updatedAt: String = "",
    @SerializedName("packages") val packages: List<FirmwarePackage> = emptyList()
)

data class FirmwarePackage(
    @SerializedName("id") val id: String,
    @SerializedName("node_type") val nodeType: String, // e.g. "water-esp32", "fire-k210", "seismic-esp32"
    @SerializedName("display_name") val displayName: String,
    @SerializedName("version") val version: String, // e.g. "v1.4.2"
    @SerializedName("chip_type") val chipType: String, // "esp32" or "k210"
    @SerializedName("description") val description: String = "",
    @SerializedName("files") val files: List<FirmwareFileItem> = emptyList(),
    // For single package file (e.g. .kfpkg for K210 or single app .bin)
    @SerializedName("package_url") val packageUrl: String? = null,
    @SerializedName("package_sha256") val packageSha256: String? = null,
    // Offline status flags populated locally
    var isCachedLocally: Boolean = false,
    var localPath: String? = null
)

data class FirmwareFileItem(
    @SerializedName("name") val name: String, // e.g. "bootloader.bin", "partition-table.bin", "app.bin"
    @SerializedName("offset") val offsetHex: String, // e.g. "0x1000", "0x8000", "0x10000"
    @SerializedName("download_url") val downloadUrl: String,
    @SerializedName("sha256") val sha256: String? = null,
    var localCachedPath: String? = null
) {
    val offsetLong: Long
        get() {
            return try {
                if (offsetHex.startsWith("0x", ignoreCase = true)) {
                    offsetHex.substring(2).toLong(16)
                } else {
                    offsetHex.toLong()
                }
            } catch (e: Exception) {
                0L
            }
        }
}

