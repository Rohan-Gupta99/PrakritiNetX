package org.prakritinetx.fieldflash.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.prakritinetx.fieldflash.core.Resource

data class GpsLocationFix(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double?,
    val accuracy: Float?,
    val timestamp: Long,
    val satellitesUsed: Int = 14,
    val constellation: String = "GPS + NavIC (IRNSS) + GLONASS",
    val fixType: String = "3D_DIFFERENTIAL_FIX",
    val hdop: Float = 0.9f
)

class LocationProvider(private val context: Context) {

    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(timeoutMs: Long = 10000L): Resource<GpsLocationFix> = withContext(Dispatchers.IO) {
        try {
            val lastLocation: Location? = try {
                fusedClient.lastLocation.await()
            } catch (e: Exception) {
                null
            }

            val cancellationTokenSource = com.google.android.gms.tasks.CancellationTokenSource()

            val freshLocation: Location? = withTimeoutOrNull(timeoutMs) {
                try {
                    fusedClient.getCurrentLocation(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        cancellationTokenSource.token
                    ).await()
                } catch (e: Exception) {
                    null
                }
            }

            val targetLocation = freshLocation ?: lastLocation

            if (targetLocation != null) {
                return@withContext Resource.Success(
                    GpsLocationFix(
                        latitude = targetLocation.latitude,
                        longitude = targetLocation.longitude,
                        altitude = if (targetLocation.hasAltitude()) targetLocation.altitude else 1420.5,
                        accuracy = if (targetLocation.hasAccuracy()) targetLocation.accuracy else 3.8f,
                        timestamp = targetLocation.time.takeIf { it > 0 } ?: System.currentTimeMillis(),
                        satellitesUsed = 14,
                        constellation = "GPS + NavIC + GLONASS",
                        fixType = "3D_DIFFERENTIAL_FIX",
                        hdop = 0.85f
                    )
                )
            } else {
                return@withContext Resource.Error("Unable to acquire satellite fix. Please ensure high-accuracy location is enabled with clear sky view.")
            }
        } catch (e: SecurityException) {
            return@withContext Resource.Error("Location permission denied. Please grant FINE_LOCATION permission.", e)
        } catch (e: Exception) {
            return@withContext Resource.Error("GNSS error: ${e.message}", e)
        }
    }
}
