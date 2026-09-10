package org.prakritinetx.fieldflash.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.*
import com.hoho.android.usbserial.driver.UsbSerialDriver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.prakritinetx.fieldflash.FieldFlashApp
import org.prakritinetx.fieldflash.core.Constants
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.data.models.DeploymentLocationPayload
import org.prakritinetx.fieldflash.data.models.FirmwarePackage
import org.prakritinetx.fieldflash.data.repository.DeploymentRepository
import org.prakritinetx.fieldflash.data.repository.FirmwareRepository
import org.prakritinetx.fieldflash.engine.esp32.Esp32FlashPlan
import org.prakritinetx.fieldflash.engine.esp32.Esp32FlashingEngine
import org.prakritinetx.fieldflash.engine.esp32.FlashBlockTask
import org.prakritinetx.fieldflash.engine.k210.K210FlashingEngine
import org.prakritinetx.fieldflash.engine.k210.K210PackageParser
import org.prakritinetx.fieldflash.engine.serial.SerialConnectionState
import org.prakritinetx.fieldflash.engine.serial.UsbSerialManager
import org.prakritinetx.fieldflash.engine.verification.FlashVerifier
import org.prakritinetx.fieldflash.engine.verification.VerificationResult
import org.prakritinetx.fieldflash.location.BoardLocationWriter
import org.prakritinetx.fieldflash.location.GpsLocationFix
import org.prakritinetx.fieldflash.location.LocationProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

data class FlashProgressState(
    val isFlashing: Boolean = false,
    val percent: Int = 0,
    val bytesWritten: Long = 0,
    val totalBytes: Long = 0,
    val speedKbps: Float = 0f,
    val currentFileName: String = "",
    val statusText: String = "",
    val isSuccess: Boolean = false,
    val isError: Boolean = false
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val firmwareRepo = FirmwareRepository(application)
    private val deploymentRepo = (application as FieldFlashApp).deploymentRepository
    val serialManager = UsbSerialManager(application)
    private val locationProvider = LocationProvider(application)
    private val boardLocationWriter = BoardLocationWriter(serialManager)
    private val flashVerifier = FlashVerifier(serialManager)

    // Flashing engines
    val esp32Engine = Esp32FlashingEngine(serialManager)
    val k210Engine = K210FlashingEngine(serialManager)

    // UI States
    private val _firmwarePackages = MutableLiveData<Resource<List<FirmwarePackage>>>(Resource.Idle)
    val firmwarePackages: LiveData<Resource<List<FirmwarePackage>>> = _firmwarePackages

    private val _selectedPackage = MutableLiveData<FirmwarePackage?>()
    val selectedPackage: LiveData<FirmwarePackage?> = _selectedPackage

    private val _serialState = MutableLiveData<SerialConnectionState>(SerialConnectionState.Disconnected)
    val serialState: LiveData<SerialConnectionState> = _serialState

    private val _detectedChip = MutableLiveData<String>("Unknown")
    val detectedChip: LiveData<String> = _detectedChip

    private val _detectedNodeId = MutableLiveData<String>("")
    val detectedNodeId: LiveData<String> = _detectedNodeId

    private val _flashProgress = MutableLiveData<FlashProgressState>(FlashProgressState())
    val flashProgress: LiveData<FlashProgressState> = _flashProgress

    private val _verificationResult = MutableLiveData<VerificationResult?>()
    val verificationResult: LiveData<VerificationResult?> = _verificationResult

    private val _gpsFix = MutableLiveData<Resource<GpsLocationFix>>(Resource.Idle)
    val gpsFix: LiveData<Resource<GpsLocationFix>> = _gpsFix

    private val _geotagResult = MutableLiveData<Resource<String>>(Resource.Idle)
    val geotagResult: LiveData<Resource<String>> = _geotagResult

    private val _boardWriteResult = MutableLiveData<Resource<String>>(Resource.Idle)
    val boardWriteResult: LiveData<Resource<String>> = _boardWriteResult

    private val _terminalLogs = MutableLiveData<List<String>>(emptyList())
    val terminalLogs: LiveData<List<String>> = _terminalLogs

    val pendingSyncCount: LiveData<Int> = deploymentRepo.pendingCount
    val allQueuedLocations = deploymentRepo.allLocations

    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun appendLog(message: String) {
        val timestamp = timeFormat.format(Date())
        val formatted = "[$timestamp] $message"
        val current = _terminalLogs.value?.toMutableList() ?: mutableListOf()
        current.add(formatted)
        _terminalLogs.postValue(current)
    }

    fun clearLogs() {
        _terminalLogs.postValue(emptyList())
    }

    // --- Step 1: Firmware Repository & SAF ---
    fun fetchFirmwareManifest() {
        _firmwarePackages.value = Resource.Loading("Fetching manifest...")
        viewModelScope.launch {
            val result = firmwareRepo.getFirmwarePackages()
            _firmwarePackages.postValue(result)
        }
    }

    fun selectPackage(pkg: FirmwarePackage) {
        _selectedPackage.value = pkg
        appendLog("Selected Package: ${pkg.displayName} (${pkg.chipType.uppercase()}, ${pkg.version})")
    }

    fun downloadPackage(pkg: FirmwarePackage) {
        viewModelScope.launch {
            appendLog("Downloading package ${pkg.displayName} to local storage...")
            val result = firmwareRepo.downloadAndCachePackage(pkg) { percent, msg ->
                _firmwarePackages.postValue(Resource.Loading(msg, percent))
            }
            when (result) {
                is Resource.Success -> {
                    appendLog("Package successfully downloaded and cached for offline field use.")
                    _selectedPackage.postValue(result.data)
                    fetchFirmwareManifest() // Refresh list state
                }
                is Resource.Error -> {
                    appendLog("Download failed: ${result.message}")
                    _firmwarePackages.postValue(result)
                }
                else -> {}
            }
        }
    }

    fun importLocalFirmware(
        uri: Uri,
        chipType: String,
        nodeType: String,
        version: String,
        offsetHex: String = "0x10000"
    ) {
        viewModelScope.launch {
            appendLog("Importing local firmware file from device storage...")
            val res = firmwareRepo.importManualFirmware(uri, chipType, nodeType, version, offsetHex)
            if (res is Resource.Success) {
                appendLog("Imported file successfully as ${res.data.displayName}")
                _selectedPackage.postValue(res.data)
                fetchFirmwareManifest()
            } else if (res is Resource.Error) {
                appendLog("Import failed: ${res.message}")
            }
        }
    }

    // --- Step 2: USB Serial Connection ---
    fun getAvailableUsbDrivers(): List<UsbSerialDriver> {
        return serialManager.getAvailableDevices()
    }

    fun connectSerial(driver: UsbSerialDriver, baudRate: Int = Constants.BAUD_BOOTLOADER_DEFAULT) {
        _serialState.value = SerialConnectionState.Connecting
        appendLog("Connecting to USB device: ${driver.device.deviceName} (Vendor 0x${Integer.toHexString(driver.device.vendorId)})...")
        viewModelScope.launch {
            val res = serialManager.open(driver, 0, baudRate)
            _serialState.postValue(res)
            if (res is SerialConnectionState.Connected) {
                appendLog("Serial Port Connected: ${res.deviceName} (${res.driverName})")
            } else if (res is SerialConnectionState.Error) {
                appendLog("Connection Error: ${res.message}")
            }
        }
    }

    fun disconnectSerial() {
        serialManager.close()
        _serialState.value = SerialConnectionState.Disconnected
        appendLog("USB Serial Disconnected.")
    }

    fun handshakeAndIdentifyChip() {
        viewModelScope.launch {
            val pkg = _selectedPackage.value
            val isK210 = pkg?.chipType.equals("k210", ignoreCase = true)

            appendLog("Initiating chip handshake protocol...")
            if (isK210) {
                val synced = k210Engine.connectAndSync { appendLog(it) }
                if (synced) {
                    _detectedChip.postValue(k210Engine.detectedChip)
                    _detectedNodeId.postValue(k210Engine.detectedChipId)
                    appendLog("Chip Handshake SUCCESS: ${k210Engine.detectedChip} [ID: ${k210Engine.detectedChipId}]")
                } else {
                    appendLog("Chip Handshake FAILED for Kendryte K210.")
                }
            } else {
                val synced = esp32Engine.connectAndSync { appendLog(it) }
                if (synced) {
                    _detectedChip.postValue(esp32Engine.detectedChip)
                    _detectedNodeId.postValue(esp32Engine.detectedMacAddress)
                    appendLog("Chip Handshake SUCCESS: ${esp32Engine.detectedChip} [MAC: ${esp32Engine.detectedMacAddress}]")
                } else {
                    appendLog("Chip Handshake FAILED for ESP32.")
                }
            }
        }
    }

    // --- Step 3: Firmware Flashing ---
    fun startFlashing() {
        val pkg = _selectedPackage.value ?: run {
            appendLog("Error: No firmware package selected!")
            return
        }

        _flashProgress.value = FlashProgressState(
            isFlashing = true,
            statusText = "Starting flashing process..."
        )

        viewModelScope.launch {
            val isK210 = pkg.chipType.equals("k210", ignoreCase = true)

            if (isK210) {
                flashK210(pkg)
            } else {
                flashEsp32(pkg)
            }
        }
    }

    private suspend fun flashEsp32(pkg: FirmwarePackage) {
        appendLog("Preparing ESP32 flashing engine for ${pkg.displayName}...")

        // Synchronize with ESP32 bootloader
        val synced = esp32Engine.connectAndSync { appendLog(it) }
        if (!synced) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Failed to sync with ESP32 bootloader"
                )
            )
            return
        }

        _detectedChip.postValue(esp32Engine.detectedChip)
        _detectedNodeId.postValue(esp32Engine.detectedMacAddress)

        // Build Flash Tasks:
        // Must flash three files at required fixed offsets:
        // 1. bootloader.bin at 0x1000 (or 0x0 for S3)
        // 2. partition-table.bin at 0x8000
        // 3. app firmware .bin at 0x10000
        val isS3 = esp32Engine.detectedChip.contains("S3", ignoreCase = true)
        val tasks = mutableListOf<FlashBlockTask>()

        if (pkg.files.isNotEmpty()) {
            for (f in pkg.files) {
                val localPath = f.localCachedPath ?: (pkg.localPath + "/" + f.name)
                val file = File(localPath)
                if (file.exists()) {
                    var offset = f.offsetLong
                    // If bootloader and S3, adjust offset to 0x0 if needed
                    if (isS3 && f.name.contains("bootloader", ignoreCase = true)) {
                        offset = Constants.ESP32_S3_OFFSET_BOOTLOADER
                    }
                    tasks.add(FlashBlockTask(f.name, offset, file, file.length()))
                } else {
                    appendLog("Error: Firmware component file missing: ${f.name} at $localPath")
                }
            }
        } else if (!pkg.localPath.isNullOrEmpty()) {
            // Single manual binary flashed as app.bin at 0x10000
            val file = File(pkg.localPath!!)
            tasks.add(FlashBlockTask(file.name, Constants.ESP32_OFFSET_APP, file, file.length()))
        }

        if (tasks.isEmpty()) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "No valid firmware files available to flash"
                )
            )
            return
        }

        val plan = Esp32FlashPlan(isS3, tasks)
        val success = esp32Engine.flashAll(
            plan = plan,
            highSpeedBaud = Constants.BAUD_FLASH_ESP_SAFE,
            onProgress = { overallPercent, bytesWritten, totalBytes, speedKbps, currentFile ->
                _flashProgress.postValue(
                    FlashProgressState(
                        isFlashing = true,
                        percent = overallPercent,
                        bytesWritten = bytesWritten,
                        totalBytes = totalBytes,
                        speedKbps = speedKbps,
                        currentFileName = currentFile,
                        statusText = "Writing $currentFile ($overallPercent%)"
                    )
                )
            },
            onLog = { appendLog(it) }
        )

        if (success) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isSuccess = true,
                    percent = 100,
                    statusText = "ESP32 Flashing Complete! Ready for Verification."
                )
            )
            // Automatically launch verification step
            runVerification()
        } else {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "ESP32 Flash Failed. Review terminal logs."
                )
            )
        }
    }

    private suspend fun flashK210(pkg: FirmwarePackage) {
        appendLog("Preparing Kendryte K210 flashing engine for ${pkg.displayName}...")

        val synced = k210Engine.connectAndSync { appendLog(it) }
        if (!synced) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Failed to sync with K210 ISP bootloader"
                )
            )
            return
        }

        _detectedChip.postValue(k210Engine.detectedChip)
        _detectedNodeId.postValue(k210Engine.detectedChipId)

        val packageFile = File(pkg.localPath ?: "")
        if (!packageFile.exists()) {
            appendLog("Error: K210 package file missing at ${pkg.localPath}")
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Package file not found on disk"
                )
            )
            return
        }

        val parser = K210PackageParser(getApplication<Application>().cacheDir)
        val tasks = parser.parse(packageFile, Constants.K210_OFFSET_APP)

        val success = k210Engine.flashTasks(
            tasks = tasks,
            highSpeedBaud = Constants.BAUD_FLASH_K210_FAST,
            onProgress = { overallPercent, bytesWritten, totalBytes, speedKbps, currentFile ->
                _flashProgress.postValue(
                    FlashProgressState(
                        isFlashing = true,
                        percent = overallPercent,
                        bytesWritten = bytesWritten,
                        totalBytes = totalBytes,
                        speedKbps = speedKbps,
                        currentFileName = currentFile,
                        statusText = "Writing $currentFile ($overallPercent%)"
                    )
                )
            },
            onLog = { appendLog(it) }
        )

        if (success) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isSuccess = true,
                    percent = 100,
                    statusText = "K210 Flashing Complete! Ready for Verification."
                )
            )
            runVerification()
        } else {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "K210 Flash Failed. Review terminal logs."
                )
            )
        }
    }

    // --- Step 4: Flash Verification ---
    fun runVerification() {
        val pkg = _selectedPackage.value
        val expectedVer = pkg?.version ?: "v1.0.0"
        val fallbackId = _detectedNodeId.value?.takeIf { it.isNotBlank() }
            ?: ("NODE_" + System.currentTimeMillis().toString().takeLast(6))

        viewModelScope.launch {
            appendLog("Starting post-flash verification for version '$expectedVer'...")
            val result = flashVerifier.verifyFirmware(expectedVer, fallbackId) { appendLog(it) }
            _verificationResult.postValue(result)
            if (result is VerificationResult.Success) {
                _detectedNodeId.postValue(result.nodeId)
            }
        }
    }

    // --- Step 5: Geotagging & Deployment Registration ---
    fun acquireGpsLocation() {
        _gpsFix.value = Resource.Loading("Acquiring high-accuracy GPS fix from satellites...")
        viewModelScope.launch {
            appendLog("Requesting GPS fix via FusedLocationProviderClient...")
            val result = locationProvider.getCurrentLocation(12000L)
            _gpsFix.postValue(result)
            if (result is Resource.Success) {
                val fix = result.data
                appendLog("GPS Acquired: Lat ${fix.latitude}, Lon ${fix.longitude} (Accuracy: ±${fix.accuracy ?: 0f}m)")
            } else if (result is Resource.Error) {
                appendLog("GPS Failed: ${result.message}")
            }
        }
    }

    fun confirmDeploymentLocation(writeToBoard: Boolean, technicianNotes: String?) {
        val fixRes = _gpsFix.value
        if (fixRes !is Resource.Success) {
            _geotagResult.value = Resource.Error("Valid GPS coordinates required before confirming deployment location.")
            return
        }

        val fix = fixRes.data
        val nodeId = _detectedNodeId.value?.takeIf { it.isNotBlank() }
            ?: ("NODE_" + System.currentTimeMillis().toString().takeLast(6))
        val firmwareVer = _selectedPackage.value?.version ?: "unknown"
        val chipType = _detectedChip.value ?: "unknown"

        _geotagResult.value = Resource.Loading("Registering deployment location...")

        viewModelScope.launch {
            // Optional Step: write to board flash/EEPROM over USB-serial
            var writtenSuccessfully = false
            if (writeToBoard) {
                appendLog("Optional write-back enabled: writing coordinates to node EEPROM...")
                val boardRes = boardLocationWriter.writeLocationToBoard(fix) { appendLog(it) }
                _boardWriteResult.postValue(boardRes)
                writtenSuccessfully = boardRes is Resource.Success
            }

            // Create deployment record payload
            val payload = DeploymentLocationPayload(
                nodeId = nodeId,
                latitude = fix.latitude,
                longitude = fix.longitude,
                altitude = fix.altitude,
                accuracy = fix.accuracy,
                timestamp = fix.timestamp,
                firmwareVersion = firmwareVer,
                chipType = chipType,
                writtenToBoard = writtenSuccessfully,
                technicianNotes = technicianNotes
            )

            appendLog("Recording deployment geotag for node $nodeId at (${fix.latitude}, ${fix.longitude})...")
            val recordResult = deploymentRepo.recordAndSyncLocation(payload)
            _geotagResult.postValue(recordResult)
            if (recordResult is Resource.Success) {
                appendLog("Deployment recorded: ${recordResult.data}")
            } else if (recordResult is Resource.Error) {
                appendLog("Geotag Error: ${recordResult.message}")
            }
        }
    }

    // --- Settings / Sync ---
    fun syncPendingRecordsNow() {
        viewModelScope.launch {
            appendLog("Triggering manual sync of pending offline deployments...")
            val result = deploymentRepo.syncAllNow()
            if (result is Resource.Success) {
                appendLog("Manual sync complete: ${result.data} record(s) synced.")
            } else if (result is Resource.Error) {
                appendLog("Manual sync failed: ${result.message}")
            }
        }
    }

    fun clearSyncedRecords() {
        viewModelScope.launch {
            deploymentRepo.clearSyncedLocations()
            appendLog("Cleared synced records from history.")
        }
    }
}

