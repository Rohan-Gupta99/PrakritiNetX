package org.prakritinetx.fieldflash.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import org.prakritinetx.fieldflash.data.models.DeploymentLocationPayload

@Entity(tableName = "queued_locations")
data class QueuedLocationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val nodeId: String,
    val latitude: Double,
    val longitude: Double,
    val altitude: Double? = null,
    val accuracy: Float? = null,
    val timestamp: Long,
    val firmwareVersion: String,
    val chipType: String? = null,
    val writtenToBoard: Boolean = false,
    val technicianNotes: String? = null,
    val syncStatus: String = "PENDING", // PENDING, FAILED, SYNCED
    val retryCount: Int = 0,
    val lastAttemptTimestamp: Long = 0L,
    val errorMessage: String? = null
) {
    fun toPayload(): DeploymentLocationPayload {
        return DeploymentLocationPayload(
            nodeId = nodeId,
            latitude = latitude,
            longitude = longitude,
            altitude = altitude,
            accuracy = accuracy,
            timestamp = timestamp,
            firmwareVersion = firmwareVersion,
            chipType = chipType,
            writtenToBoard = writtenToBoard,
            technicianNotes = technicianNotes
        )
    }
}

