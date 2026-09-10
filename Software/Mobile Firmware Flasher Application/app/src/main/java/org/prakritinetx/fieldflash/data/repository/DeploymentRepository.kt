package org.prakritinetx.fieldflash.data.repository

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.lifecycle.LiveData
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.data.api.ApiClient
import org.prakritinetx.fieldflash.data.db.FieldFlashDatabase
import org.prakritinetx.fieldflash.data.db.entity.QueuedLocationEntity
import org.prakritinetx.fieldflash.data.models.DeploymentLocationPayload
import org.prakritinetx.fieldflash.data.worker.LocationSyncWorker
import java.util.concurrent.TimeUnit

class DeploymentRepository(private val context: Context) {

    private val db = FieldFlashDatabase.getInstance(context)
    private val locationDao = db.queuedLocationDao()
    private val apiClient = ApiClient.getInstance(context)
    private val workManager = WorkManager.getInstance(context)

    val pendingCount: LiveData<Int> = locationDao.getPendingCountLiveData()
    val allLocations: LiveData<List<QueuedLocationEntity>> = locationDao.getAllLocationsLiveData()

    private fun isOnline(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun recordAndSyncLocation(
        payload: DeploymentLocationPayload
    ): Resource<String> = withContext(Dispatchers.IO) {
        // 1. Always persist to local Room DB first (Offline-first architecture)
        val entity = QueuedLocationEntity(
            nodeId = payload.nodeId,
            latitude = payload.latitude,
            longitude = payload.longitude,
            altitude = payload.altitude,
            accuracy = payload.accuracy,
            timestamp = payload.timestamp,
            firmwareVersion = payload.firmwareVersion,
            chipType = payload.chipType,
            writtenToBoard = payload.writtenToBoard,
            technicianNotes = payload.technicianNotes,
            syncStatus = "PENDING"
        )
        val localId = locationDao.insertLocation(entity)

        // 2. Check if currently online
        if (isOnline()) {
            try {
                val response = apiClient.locationApi.registerDeploymentLocation(payload.nodeId, payload)
                if (response.isSuccessful) {
                    locationDao.markAsSynced(localId)
                    return@withContext Resource.Success("Deployment location uploaded and registered with cloud backend.")
                } else {
                    val err = "HTTP ${response.code()}: ${response.message()}"
                    locationDao.markAsFailed(localId, err, System.currentTimeMillis())
                    scheduleAutoSyncWork()
                    return@withContext Resource.Success("Uploaded failed ($err). Saved to offline queue; will auto-sync when online.")
                }
            } catch (e: Exception) {
                locationDao.markAsFailed(localId, e.message ?: "Network error", System.currentTimeMillis())
                scheduleAutoSyncWork()
                return@withContext Resource.Success("Remote site offline. Deployment saved to offline queue; will auto-sync when connection returns.")
            }
        } else {
            // Site is offline
            scheduleAutoSyncWork()
            return@withContext Resource.Success("Remote site offline. Deployment saved to local offline queue; will automatically sync once phone reconnects to internet.")
        }
    }

    fun scheduleAutoSyncWork() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<LocationSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()

        workManager.enqueueUniqueWork(
            Constants.WORKER_SYNC_LOCATIONS,
            ExistingWorkPolicy.KEEP,
            syncRequest
        )
    }

    suspend fun syncAllNow(): Resource<Int> = withContext(Dispatchers.IO) {
        if (!isOnline()) {
            return@withContext Resource.Error("Device is still offline. Please connect to Wi-Fi or cellular network to sync.")
        }
        val pending = locationDao.getPendingLocations()
        if (pending.isEmpty()) {
            return@withContext Resource.Success(0)
        }

        var syncedCount = 0
        for (item in pending) {
            try {
                val resp = apiClient.locationApi.registerDeploymentLocation(item.nodeId, item.toPayload())
                if (resp.isSuccessful) {
                    locationDao.markAsSynced(item.id)
                    syncedCount++
                } else {
                    locationDao.markAsFailed(item.id, "HTTP ${resp.code()}", System.currentTimeMillis())
                }
            } catch (e: Exception) {
                locationDao.markAsFailed(item.id, e.message ?: "Sync error", System.currentTimeMillis())
            }
        }

        return@withContext Resource.Success(syncedCount)
    }

    suspend fun clearSyncedLocations() = withContext(Dispatchers.IO) {
        locationDao.clearSynced()
    }
}

