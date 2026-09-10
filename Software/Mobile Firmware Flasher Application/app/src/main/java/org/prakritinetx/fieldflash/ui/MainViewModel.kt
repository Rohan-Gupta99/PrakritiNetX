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
import org.prakritinetx.fieldflash.engine.verification.NodeRuntimeTelemetry
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

    val esp32Engine = Esp32FlashingEngine(serialManager)
    val k210Engine = K210FlashingEngine(serialManager)

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

    private val _lastTelemetry = MutableLiveData<NodeRuntimeTelemetry>(NodeRuntimeTelemetry())
    val lastTelemetry: LiveData<NodeRuntimeTelemetry> = _lastTelemetry

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

    fun fetchFirmwareManifest() {
        _firmwarePackages.value = Resource.Loading("Connecting to PrakritiNetX Release Repository...")
        viewModelScope.launch {
            val result = firmwareRepo.getFirmwarePackages()
            _firmwarePackages.postValue(result)
        }
    }

    fun selectPackage(pkg: FirmwarePackage) {
        _selectedPackage.value = pkg
        appendLog("Selected Release: ${pkg.displayName} (${pkg.chipType.uppercase()}, ${pkg.version})")
    }

    fun downloadPackage(pkg: FirmwarePackage) {
        viewModelScope.launch {
            appendLog("Caching cryptographically-signed package ${pkg.displayName}...")
            val result = firmwareRepo.downloadAndCachePackage(pkg) { percent, msg ->
                _firmwarePackages.postValue(Resource.Loading(msg, percent))
            }
            when (result) {
                is Resource.Success -> {
                    appendLog("Package integrity verified and cached for offline field operations.")
                    _selectedPackage.postValue(result.data)
                    fetchFirmwareManifest()
                }
                is Resource.Error -> {
                    appendLog("Package download error: ${result.message}")
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
            appendLog("Importing local signed firmware package from device storage...")
            val res = firmwareRepo.importManualFirmware(uri, chipType, nodeType, version, offsetHex)
            if (res is Resource.Success) {
                appendLog("Import successful: ${res.data.displayName}")
                _selectedPackage.postValue(res.data)
                fetchFirmwareManifest()
            } else if (res is Resource.Error) {
                appendLog("Import error: ${res.message}")
            }
        }
    }

    fun getAvailableUsbDrivers(): List<UsbSerialDriver> {
        return serialManager.getAvailableDevices()
    }

    fun connectSerial(driver: UsbSerialDriver, baudRate: Int = Constants.BAUD_BOOTLOADER_DEFAULT) {
        _serialState.value = SerialConnectionState.Connecting
        appendLog("Initializing USB Host link: ${driver.device.deviceName} (Vendor 0x${Integer.toHexString(driver.device.vendorId).uppercase()})...")
        viewModelScope.launch {
            val res = serialManager.open(driver, 0, baudRate)
            _serialState.postValue(res)
            if (res is SerialConnectionState.Connected) {
                appendLog("Hardware Port Active: ${res.deviceName} (${res.driverName})")
            } else if (res is SerialConnectionState.Error) {
                appendLog("Hardware Link Error: ${res.message}")
            }
        }
    }

    fun disconnectSerial() {
        serialManager.close()
        _serialState.value = SerialConnectionState.Disconnected
        appendLog("USB Serial link released.")
    }

    fun handshakeAndIdentifyChip() {
        viewModelScope.launch {
            val pkg = _selectedPackage.value
            val isK210 = pkg?.chipType.equals("k210", ignoreCase = true)

            appendLog("Asserting hardware handshake protocol...")
            if (isK210) {
                val synced = k210Engine.connectAndSync { appendLog(it) }
                if (synced) {
                    _detectedChip.postValue(k210Engine.detectedChip)
                    _detectedNodeId.postValue(k210Engine.detectedChipId)
                    appendLog("Hardware Target Locked: ${k210Engine.detectedChip} [UID: ${k210Engine.detectedChipId}]")
                } else {
                    appendLog("Hardware Handshake FAILED for Kendryte K210.")
                }
            } else {
                val synced = esp32Engine.connectAndSync { appendLog(it) }
                if (synced) {
                    _detectedChip.postValue(esp32Engine.detectedChip)
                    _detectedNodeId.postValue(esp32Engine.detectedMacAddress)
                    appendLog("Hardware Target Locked: ${esp32Engine.detectedChip} [MAC: ${esp32Engine.detectedMacAddress}]")
                } else {
                    appendLog("Hardware Handshake FAILED for ESP32 target.")
                }
            }
        }
    }

    fun startFlashing() {
        val pkg = _selectedPackage.value ?: run {
            appendLog("Error: No firmware package selected.")
            return
        }

        _flashProgress.value = FlashProgressState(
            isFlashing = true,
            statusText = "Initializing hardware flash controller..."
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
        appendLog("Initializing ESP32 Flashing Engine for ${pkg.displayName}...")

        val synced = esp32Engine.connectAndSync { appendLog(it) }
        if (!synced) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Failed to synchronize with ROM bootloader"
                )
            )
            return
        }

        _detectedChip.postValue(esp32Engine.detectedChip)
        _detectedNodeId.postValue(esp32Engine.detectedMacAddress)

        val isS3 = esp32Engine.detectedChip.contains("S3", ignoreCase = true)
        val tasks = mutableListOf<FlashBlockTask>()

        if (pkg.files.isNotEmpty()) {
            for (f in pkg.files) {
                val localPath = f.localCachedPath ?: (pkg.localPath + "/" + f.name)
                val file = File(localPath)
                if (file.exists()) {
                    var offset = f.offsetLong
                    if (isS3 && f.name.contains("bootloader", ignoreCase = true)) {
                        offset = Constants.ESP32_S3_OFFSET_BOOTLOADER
                    }
                    tasks.add(FlashBlockTask(f.name, offset, file, file.length()))
                } else {
                    appendLog("File missing: ${f.name} at $localPath")
                }
            }
        } else if (!pkg.localPath.isNullOrEmpty()) {
            val file = File(pkg.localPath!!)
            tasks.add(FlashBlockTask(file.name, Constants.ESP32_OFFSET_APP, file, file.length()))
        }

        if (tasks.isEmpty()) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "No verified firmware binaries found on disk"
                )
            )
            return
        }

        val plan = Esp32FlashPlan(isS3, tasks)
        val success = esp32Engine.flashAll(
            plan = plan,
            targetBaud = Constants.BAUD_FLASH_HIGH_SPEED,
            onProgress = { overallPercent, bytesWritten, totalBytes, speedKbps, currentFile ->
                _flashProgress.postValue(
                    FlashProgressState(
                        isFlashing = true,
                        percent = overallPercent,
                        bytesWritten = bytesWritten,
                        totalBytes = totalBytes,
                        speedKbps = speedKbps,
                        currentFileName = currentFile,
                        statusText = "Flashing $currentFile ($overallPercent%)"
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
                    statusText = "Flashing Complete! Running runtime diagnostic verification..."
                )
            )
            runVerification()
        } else {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Flashing Interrupted. Review diagnostics log."
                )
            )
        }
    }

    private suspend fun flashK210(pkg: FirmwarePackage) {
        appendLog("Initializing Kendryte K210 ISP Engine for ${pkg.displayName}...")

        val synced = k210Engine.connectAndSync { appendLog(it) }
        if (!synced) {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Failed to sync with K210 ISP engine"
                )
            )
            return
        }

        _detectedChip.postValue(k210Engine.detectedChip)
        _detectedNodeId.postValue(k210Engine.detectedChipId)

        val packageFile = File(pkg.localPath ?: "")
        if (!packageFile.exists()) {
            appendLog("Error: Package file missing at ${pkg.localPath}")
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "Package bundle missing"
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
                        statusText = "Flashing $currentFile ($overallPercent%)"
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
                    statusText = "K210 Flashing Complete! Running runtime diagnostic verification..."
                )
            )
            runVerification()
        } else {
            _flashProgress.postValue(
                FlashProgressState(
                    isFlashing = false,
                    isError = true,
                    statusText = "K210 Flashing Failed. Check diagnostics terminal."
                )
            )
        }
    }

    fun runVerification() {
        val pkg = _selectedPackage.value
        val expectedVer = pkg?.version ?: "v1.4.0"
        val fallbackId = _detectedNodeId.value?.takeIf { it.isNotBlank() }
            ?: ("NODE_" + System.currentTimeMillis().toString().takeLast(6))

        viewModelScope.launch {
            appendLog("Starting Post-Flash Diagnostics Verification for release '$expectedVer'...")
            val result = flashVerifier.verifyFirmware(expectedVer, fallbackId) { appendLog(it) }
            _verificationResult.postValue(result)
            if (result is VerificationResult.Success) {
                _detectedNodeId.postValue(result.nodeId)
                _lastTelemetry.postValue(result.telemetry)
            }
        }
    }

    fun acquireGpsLocation() {
        _gpsFix.value = Resource.Loading("Acquiring GNSS Satellite Lock (GPS + NavIC + GLONASS)...")
        viewModelScope.launch {
            appendLog("Requesting GNSS multi-constellation fix (FusedLocationProvider)...")
            val result = locationProvider.getCurrentLocation(12000L)
            _gpsFix.postValue(result)
            if (result is Resource.Success) {
                val fix = result.data
                appendLog("GNSS Fix: Lat ${fix.latitude}°, Lon ${fix.longitude}° | ${fix.satellitesUsed} sats | ${fix.constellation} | HDOP: ${fix.hdop}")
            } else if (result is Resource.Error) {
                appendLog("GNSS Fix Failed: ${result.message}")
            }
        }
    }

    fun confirmDeploymentLocation(
        writeToBoard: Boolean,
        technicianNotes: String?,
        catchmentBasin: String = "Alaknanda Upper Catchment",
        mountingHeight: Float = 24.5f
    ) {
        val fixRes = _gpsFix.value
        if (fixRes !is Resource.Success) {
            _geotagResult.value = Resource.Error("Valid GNSS satellite fix required before confirming deployment location.")
            return
        }

        val fix = fixRes.data
        val nodeId = _detectedNodeId.value?.takeIf { it.isNotBlank() }
            ?: ("NODE_" + System.currentTimeMillis().toString().takeLast(6))
        val firmwareVer = _selectedPackage.value?.version ?: "v1.4.0"
        val chipType = _detectedChip.value ?: "ESP32-S3"
        val telemetry = _lastTelemetry.value ?: NodeRuntimeTelemetry()

        _geotagResult.value = Resource.Loading("Registering physical deployment record...")

        viewModelScope.launch {
            var writtenSuccessfully = false
            if (writeToBoard) {
                appendLog("Writing deployment coordinates to node EEPROM/NVS over USB...")
                val boardRes = boardLocationWriter.writeLocationToBoard(fix) { appendLog(it) }
                _boardWriteResult.postValue(boardRes)
                writtenSuccessfully = boardRes is Resource.Success
            }

            val payload = DeploymentLocationPayload(
                nodeId = nodeId,
                latitude = fix.latitude,
                longitude = fix.longitude,
                altitude = fix.altitude,
                accuracy = fix.accuracy,
                satellitesUsed = fix.satellitesUsed,
                gnssConstellation = fix.constellation,
                hdop = fix.hdop,
                timestamp = fix.timestamp,
                firmwareVersion = firmwareVer,
                chipType = chipType,
                catchmentBasin = catchmentBasin,
                mountingHeightMeters = mountingHeight,
                writtenToBoard = writtenSuccessfully,
                batteryVoltageMv = telemetry.batteryMv,
                technicianNotes = technicianNotes
            )

            appendLog("Recording deployment record for node $nodeId at (${fix.latitude}, ${fix.longitude}) in $catchmentBasin...")
            val recordResult = deploymentRepo.recordAndSyncLocation(payload)
            _geotagResult.postValue(recordResult)
            if (recordResult is Resource.Success) {
                appendLog("Deployment registered: ${recordResult.data}")
            } else if (recordResult is Resource.Error) {
                appendLog("Registration Notice: ${recordResult.message}")
            }
        }
    }

    fun syncPendingRecordsNow() {
        viewModelScope.launch {
            appendLog("Initiating manual synchronization of queued deployments...")
            val result = deploymentRepo.syncAllNow()
            if (result is Resource.Success) {
                appendLog("Sync complete: ${result.data} record(s) synchronized.")
            } else if (result is Resource.Error) {
                appendLog("Sync notice: ${result.message}")
            }
        }
    }

    fun clearSyncedRecords() {
        viewModelScope.launch {
            deploymentRepo.clearSyncedLocations()
            appendLog("Synced history cleared.")
        }
    }
}
