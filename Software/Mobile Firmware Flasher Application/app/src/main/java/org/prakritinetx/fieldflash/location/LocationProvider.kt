package org.prakritinetx.fieldflash.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.prakritinetx.fieldflash.core.Resource

data class GpsLocationFix(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double?,
    val accuracy: Float?,
    val timestamp: Long
)

class LocationProvider(private val context: Context) {

    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(timeoutMs: Long = 10000L): Resource<GpsLocationFix> = withContext(Dispatchers.IO) {
        try {
            // First check last known location for quick response
            val lastLocation: Location? = try {
                fusedClient.lastLocation.await()
            } catch (e: Exception) {
                null
            }

            // Request fresh high-accuracy GPS fix with cancellation token
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
                        altitude = if (targetLocation.hasAltitude()) targetLocation.altitude else null,
                        accuracy = if (targetLocation.hasAccuracy()) targetLocation.accuracy else null,
                        timestamp = targetLocation.time.takeIf { it > 0 } ?: System.currentTimeMillis()
                    )
                )
            } else {
                return@withContext Resource.Error("Unable to acquire GPS fix. Please ensure location services are enabled and phone has an open view of the sky.")
            }
        } catch (e: SecurityException) {
            return@withContext Resource.Error("Location permission denied. Please grant FINE_LOCATION permission in App Settings.", e)
        } catch (e: Exception) {
            return@withContext Resource.Error("GPS error: ${e.message}", e)
        }
    }
}

