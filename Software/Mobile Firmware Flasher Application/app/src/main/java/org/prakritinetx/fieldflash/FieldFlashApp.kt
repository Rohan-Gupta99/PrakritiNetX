package org.prakritinetx.fieldflash

import android.app.Application
import org.prakritinetx.fieldflash.data.repository.DeploymentRepository

class FieldFlashApp : Application() {

    lateinit var deploymentRepository: DeploymentRepository
        private set

    override fun onCreate() {
        super.onCreate()
        deploymentRepository = DeploymentRepository(this)
        // Ensure background sync worker is scheduled for any pending records
        deploymentRepository.scheduleAutoSyncWork()
    }
}

