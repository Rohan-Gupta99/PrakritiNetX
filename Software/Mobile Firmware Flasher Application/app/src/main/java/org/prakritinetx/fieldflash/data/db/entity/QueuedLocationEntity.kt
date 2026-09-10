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
    val satellitesUsed: Int = 14,
    val gnssConstellation: String = "GPS+NavIC+GLONASS",
    val hdop: Float = 0.85f,
    val timestamp: Long,
    val firmwareVersion: String,
    val chipType: String? = null,
    val catchmentBasin: String? = "Alaknanda Upper Catchment",
    val mountingHeightMeters: Float = 24.5f,
    val writtenToBoard: Boolean = false,
    val batteryVoltageMv: Int = 12450,
    val technicianNotes: String? = null,
    val syncStatus: String = "PENDING",
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
            satellitesUsed = satellitesUsed,
            gnssConstellation = gnssConstellation,
            hdop = hdop,
            timestamp = timestamp,
            firmwareVersion = firmwareVersion,
            chipType = chipType,
            catchmentBasin = catchmentBasin,
            mountingHeightMeters = mountingHeightMeters,
            writtenToBoard = writtenToBoard,
            batteryVoltageMv = batteryVoltageMv,
            technicianNotes = technicianNotes
        )
    }
}
