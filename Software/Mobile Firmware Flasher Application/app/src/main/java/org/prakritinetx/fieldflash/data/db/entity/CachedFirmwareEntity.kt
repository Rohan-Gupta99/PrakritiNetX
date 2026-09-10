package org.prakritinetx.fieldflash.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_firmware")
data class CachedFirmwareEntity(
    @PrimaryKey val id: String,
    val nodeType: String,
    val displayName: String,
    val version: String,
    val chipType: String,
    val description: String,
    val localFilesJson: String, // Serialized list of files + offsets + cached file paths
    val packageLocalPath: String? = null,
    val downloadTimestamp: Long = System.currentTimeMillis(),
    val isUserImported: Boolean = false
)

