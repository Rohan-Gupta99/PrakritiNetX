package org.prakritinetx.fieldflash.data.db.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import org.prakritinetx.fieldflash.data.db.entity.CachedFirmwareEntity

@Dao
interface CachedFirmwareDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(firmware: CachedFirmwareEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(firmwares: List<CachedFirmwareEntity>)

    @Query("SELECT * FROM cached_firmware ORDER BY downloadTimestamp DESC")
    fun getAllCachedFirmwareLiveData(): LiveData<List<CachedFirmwareEntity>>

    @Query("SELECT * FROM cached_firmware ORDER BY downloadTimestamp DESC")
    suspend fun getAllCachedFirmware(): List<CachedFirmwareEntity>

    @Query("SELECT * FROM cached_firmware WHERE id = :id LIMIT 1")
    suspend fun getFirmwareById(id: String): CachedFirmwareEntity?

    @Query("DELETE FROM cached_firmware WHERE id = :id")
    suspend fun deleteById(id: String)
}

