package org.prakritinetx.fieldflash.data.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.prakritinetx.fieldflash.data.api.ApiClient
import org.prakritinetx.fieldflash.data.db.FieldFlashDatabase

class LocationSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val db = FieldFlashDatabase.getInstance(appContext)
    private val locationDao = db.queuedLocationDao()
    private val apiClient = ApiClient.getInstance(appContext)

    override suspend fun doWork(): Result {
        Log.i(TAG, "LocationSyncWorker triggered - checking for pending geotag registrations")
        val pending = locationDao.getPendingLocations()
        if (pending.isEmpty()) {
            Log.i(TAG, "No pending geotag records to sync.")
            return Result.success()
        }

        var anyFailed = false

        for (item in pending) {
            try {
                val payload = item.toPayload()
                Log.d(TAG, "Syncing geotag for node: ${item.nodeId} (${item.latitude}, ${item.longitude})")
                val response = apiClient.locationApi.registerDeploymentLocation(item.nodeId, payload)
                if (response.isSuccessful) {
                    locationDao.markAsSynced(item.id)
                    Log.i(TAG, "Successfully synced geotag for node: ${item.nodeId}")
                } else {
                    val errorMsg = "HTTP ${response.code()}: ${response.message()}"
                    locationDao.markAsFailed(item.id, errorMsg, System.currentTimeMillis())
                    Log.w(TAG, "Failed to sync node ${item.nodeId}: $errorMsg")
                    anyFailed = true
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception syncing node ${item.nodeId}: ${e.message}", e)
                locationDao.markAsFailed(item.id, e.message ?: "Network error", System.currentTimeMillis())
                anyFailed = true
            }
        }

        return if (anyFailed) Result.retry() else Result.success()
    }

    companion object {
        private const val TAG = "LocationSyncWorker"
    }
}

