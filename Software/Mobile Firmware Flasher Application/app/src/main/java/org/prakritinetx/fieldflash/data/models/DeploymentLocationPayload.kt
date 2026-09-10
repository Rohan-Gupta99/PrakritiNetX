package org.prakritinetx.fieldflash.data.models

import com.google.gson.annotations.SerializedName

data class DeploymentLocationPayload(
    @SerializedName("node_id") val nodeId: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("altitude") val altitude: Double? = null,
    @SerializedName("accuracy") val accuracy: Float? = null,
    @SerializedName("satellites_used") val satellitesUsed: Int = 14,
    @SerializedName("gnss_constellation") val gnssConstellation: String = "GPS+NavIC+GLONASS",
    @SerializedName("hdop") val hdop: Float = 0.85f,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("firmware_version") val firmwareVersion: String,
    @SerializedName("chip_type") val chipType: String? = null,
    @SerializedName("catchment_basin") val catchmentBasin: String? = "Alaknanda Upper Catchment",
    @SerializedName("mounting_height_meters") val mountingHeightMeters: Float = 24.5f,
    @SerializedName("written_to_board") val writtenToBoard: Boolean = false,
    @SerializedName("battery_voltage_mv") val batteryVoltageMv: Int = 12450,
    @SerializedName("technician_notes") val technicianNotes: String? = null
)

data class GenericApiResponse(
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String? = null,
    @SerializedName("id") val id: String? = null
)
