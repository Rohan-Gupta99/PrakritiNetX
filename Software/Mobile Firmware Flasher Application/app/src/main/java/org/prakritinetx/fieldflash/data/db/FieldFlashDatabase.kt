package org.prakritinetx.fieldflash.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import org.prakritinetx.fieldflash.data.db.dao.CachedFirmwareDao
import org.prakritinetx.fieldflash.data.db.dao.QueuedLocationDao
import org.prakritinetx.fieldflash.data.db.entity.CachedFirmwareEntity
import org.prakritinetx.fieldflash.data.db.entity.QueuedLocationEntity

@Database(
    entities = [QueuedLocationEntity::class, CachedFirmwareEntity::class],
    version = 1,
    exportSchema = false
)
abstract class FieldFlashDatabase : RoomDatabase() {

    abstract fun queuedLocationDao(): QueuedLocationDao
    abstract fun cachedFirmwareDao(): CachedFirmwareDao

    companion object {
        @Volatile
        private var INSTANCE: FieldFlashDatabase? = null

        fun getInstance(context: Context): FieldFlashDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    FieldFlashDatabase::class.java,
                    "fieldflash.db"
                ).fallbackToDestructiveMigration().build().also {
                    INSTANCE = it
                }
            }
        }
    }
}

