package org.prakritinetx.fieldflash.data.db.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import org.prakritinetx.fieldflash.data.db.entity.QueuedLocationEntity

@Dao
interface QueuedLocationDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLocation(location: QueuedLocationEntity): Long

    @Update
    suspend fun updateLocation(location: QueuedLocationEntity)

    @Query("SELECT * FROM queued_locations WHERE syncStatus != 'SYNCED' ORDER BY timestamp ASC")
    suspend fun getPendingLocations(): List<QueuedLocationEntity>

    @Query("SELECT * FROM queued_locations ORDER BY timestamp DESC")
    fun getAllLocationsLiveData(): LiveData<List<QueuedLocationEntity>>

    @Query("SELECT COUNT(*) FROM queued_locations WHERE syncStatus != 'SYNCED'")
    fun getPendingCountLiveData(): LiveData<Int>

    @Query("SELECT COUNT(*) FROM queued_locations WHERE syncStatus != 'SYNCED'")
    suspend fun getPendingCount(): Int

    @Query("UPDATE queued_locations SET syncStatus = 'SYNCED' WHERE id = :id")
    suspend fun markAsSynced(id: Long)

    @Query("UPDATE queued_locations SET syncStatus = 'FAILED', retryCount = retryCount + 1, errorMessage = :error, lastAttemptTimestamp = :timestamp WHERE id = :id")
    suspend fun markAsFailed(id: Long, error: String, timestamp: Long)

    @Query("DELETE FROM queued_locations WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM queued_locations WHERE syncStatus = 'SYNCED'")
    suspend fun clearSynced()
}

