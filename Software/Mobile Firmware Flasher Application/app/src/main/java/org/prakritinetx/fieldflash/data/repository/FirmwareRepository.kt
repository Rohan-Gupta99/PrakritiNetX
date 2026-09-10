package org.prakritinetx.fieldflash.data.repository

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.provider.OpenableColumns
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.data.api.ApiClient
import org.prakritinetx.fieldflash.data.db.FieldFlashDatabase
import org.prakritinetx.fieldflash.data.db.entity.CachedFirmwareEntity
import org.prakritinetx.fieldflash.data.models.FirmwareFileItem
import org.prakritinetx.fieldflash.data.models.FirmwareManifest
import org.prakritinetx.fieldflash.data.models.FirmwarePackage
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class FirmwareRepository(private val context: Context) {

    private val apiClient = ApiClient.getInstance(context)
    private val db = FieldFlashDatabase.getInstance(context)
    private val cachedDao = db.cachedFirmwareDao()
    private val gson = Gson()

    fun isOnline(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun getFirmwarePackages(): Resource<List<FirmwarePackage>> = withContext(Dispatchers.IO) {
        try {
            if (isOnline()) {
                // Fetch online manifest
                val response = apiClient.firmwareApi.getFirmwareManifest()
                if (response.isSuccessful && response.body() != null) {
                    val manifest = response.body()!!
                    // Match with local cached files
                    val packages = manifest.packages.map { pkg ->
                        checkAndPopulateLocalCache(pkg)
                    }
                    return@withContext Resource.Success(packages)
                }
            }

            // Fallback to offline cached firmware in Room DB
            val cachedEntities = cachedDao.getAllCachedFirmware()
            if (cachedEntities.isNotEmpty()) {
                val cachedPackages = cachedEntities.map { entity ->
                    val fileListType = object : TypeToken<List<FirmwareFileItem>>() {}.type
                    val files: List<FirmwareFileItem> = try {
                        gson.fromJson(entity.localFilesJson, fileListType)
                    } catch (e: Exception) {
                        emptyList()
                    }
                    FirmwarePackage(
                        id = entity.id,
                        nodeType = entity.nodeType,
                        displayName = entity.displayName,
                        version = entity.version,
                        chipType = entity.chipType,
                        description = entity.description,
                        files = files,
                        isCachedLocally = true,
                        localPath = entity.packageLocalPath
                    )
                }
                return@withContext Resource.Success(cachedPackages)
            }

            if (!isOnline()) {
                return@withContext Resource.Error("Device is offline and no cached firmware was found. Use local storage import or connect to internet.")
            }

            return@withContext Resource.Error("Failed to load firmware manifest from server.")
        } catch (e: Exception) {
            // Attempt offline fallback on exception
            val cachedEntities = cachedDao.getAllCachedFirmware()
            if (cachedEntities.isNotEmpty()) {
                val cachedPackages = cachedEntities.map { entity ->
                    val fileListType = object : TypeToken<List<FirmwareFileItem>>() {}.type
                    val files: List<FirmwareFileItem> = try {
                        gson.fromJson(entity.localFilesJson, fileListType)
                    } catch (e: Exception) {
                        emptyList()
                    }
                    FirmwarePackage(
                        id = entity.id,
                        nodeType = entity.nodeType,
                        displayName = entity.displayName,
                        version = entity.version,
                        chipType = entity.chipType,
                        description = entity.description,
                        files = files,
                        isCachedLocally = true,
                        localPath = entity.packageLocalPath
                    )
                }
                return@withContext Resource.Success(cachedPackages)
            }
            return@withContext Resource.Error("Network error: ${e.localizedMessage ?: "Unknown error"}", e)
        }
    }

    suspend fun downloadAndCachePackage(
        pkg: FirmwarePackage,
        onProgress: (percent: Int, message: String) -> Unit
    ): Resource<FirmwarePackage> = withContext(Dispatchers.IO) {
        try {
            val packageDir = File(context.filesDir, "firmware/${pkg.id}").apply { mkdirs() }
            val updatedFiles = mutableListOf<FirmwareFileItem>()

            // Case 1: Package has standalone packageUrl (e.g. .kfpkg)
            if (!pkg.packageUrl.isNullOrEmpty()) {
                onProgress(10, "Downloading ${pkg.displayName} package...")
                val ext = if (pkg.packageUrl.endsWith(".kfpkg", ignoreCase = true)) ".kfpkg" else ".bin"
                val targetFile = File(packageDir, "firmware_bundle$ext")
                downloadFileToDisk(pkg.packageUrl, targetFile) { percent ->
                    onProgress(percent, "Downloading package: $percent%")
                }
                pkg.localPath = targetFile.absolutePath
            }

            // Case 2: Package has discrete files (bootloader, partition-table, app.bin)
            if (pkg.files.isNotEmpty()) {
                val total = pkg.files.size
                pkg.files.forEachIndexed { index, fileItem ->
                    val fileTarget = File(packageDir, fileItem.name)
                    onProgress(
                        ((index * 100) / total),
                        "Downloading ${fileItem.name} (${index + 1}/$total)..."
                    )
                    downloadFileToDisk(fileItem.downloadUrl, fileTarget) { pct ->
                        val overall = ((index * 100) + pct) / total
                        onProgress(overall, "Downloading ${fileItem.name}: $pct%")
                    }
                    updatedFiles.add(fileItem.copy(localCachedPath = fileTarget.absolutePath))
                }
            }

            val readyPkg = pkg.copy(
                files = if (updatedFiles.isNotEmpty()) updatedFiles else pkg.files,
                isCachedLocally = true,
                localPath = pkg.localPath ?: packageDir.absolutePath
            )

            // Cache in Room DB for offline persistence
            val entity = CachedFirmwareEntity(
                id = readyPkg.id,
                nodeType = readyPkg.nodeType,
                displayName = readyPkg.displayName,
                version = readyPkg.version,
                chipType = readyPkg.chipType,
                description = readyPkg.description,
                localFilesJson = gson.toJson(readyPkg.files),
                packageLocalPath = readyPkg.localPath,
                downloadTimestamp = System.currentTimeMillis(),
                isUserImported = false
            )
            cachedDao.insertOrUpdate(entity)

            onProgress(100, "Package cached successfully.")
            return@withContext Resource.Success(readyPkg)
        } catch (e: Exception) {
            return@withContext Resource.Error("Failed to download and cache package: ${e.message}", e)
        }
    }

    private suspend fun downloadFileToDisk(
        url: String,
        targetFile: File,
        onProgress: (Int) -> Unit
    ) = withContext(Dispatchers.IO) {
        val fullUrl = if (url.startsWith("http://") || url.startsWith("https://")) {
            url
        } else {
            apiClient.getStoredBaseUrl() + url.removePrefix("/")
        }
        val response = apiClient.firmwareApi.downloadFirmwareFile(fullUrl)
        if (!response.isSuccessful || response.body() == null) {
            throw Exception("HTTP ${response.code()} while downloading $url")
        }

        val body: ResponseBody = response.body()!!
        val contentLength = body.contentLength()
        val inputStream: InputStream = body.byteStream()
        val outputStream = FileOutputStream(targetFile)

        inputStream.use { input ->
            outputStream.use { output ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalBytesRead = 0L
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    totalBytesRead += bytesRead
                    if (contentLength > 0) {
                        val progress = ((totalBytesRead * 100) / contentLength).toInt()
                        onProgress(progress)
                    }
                }
                output.flush()
            }
        }
    }

    private fun checkAndPopulateLocalCache(pkg: FirmwarePackage): FirmwarePackage {
        val packageDir = File(context.filesDir, "firmware/${pkg.id}")
        if (!packageDir.exists()) {
            return pkg.copy(isCachedLocally = false)
        }

        var allFilesExist = true
        val updatedFiles = pkg.files.map { fileItem ->
            val localFile = File(packageDir, fileItem.name)
            if (localFile.exists() && localFile.length() > 0) {
                fileItem.copy(localCachedPath = localFile.absolutePath)
            } else {
                allFilesExist = false
                fileItem
            }
        }

        var bundleExists = false
        if (!pkg.packageUrl.isNullOrEmpty()) {
            val ext = if (pkg.packageUrl.endsWith(".kfpkg", ignoreCase = true)) ".kfpkg" else ".bin"
            val bundleFile = File(packageDir, "firmware_bundle$ext")
            if (bundleFile.exists() && bundleFile.length() > 0) {
                bundleExists = true
                pkg.localPath = bundleFile.absolutePath
            }
        }

        val isCached = (pkg.files.isNotEmpty() && allFilesExist) || bundleExists
        return pkg.copy(
            files = updatedFiles,
            isCachedLocally = isCached,
            localPath = pkg.localPath ?: if (isCached) packageDir.absolutePath else null
        )
    }

    /**
     * Imports manually copied firmware file(s) from user-selected SAF Uri
     */
    suspend fun importManualFirmware(
        uri: Uri,
        chipType: String,
        nodeType: String,
        version: String,
        offsetHex: String = "0x10000"
    ): Resource<FirmwarePackage> = withContext(Dispatchers.IO) {
        try {
            val fileName = queryFileName(uri) ?: "imported_firmware_${System.currentTimeMillis()}.bin"
            val customId = "local_${System.currentTimeMillis()}"
            val packageDir = File(context.filesDir, "firmware/$customId").apply { mkdirs() }
            val targetFile = File(packageDir, fileName)

            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            } ?: throw Exception("Unable to open input stream for selected file.")

            val isKfpkg = fileName.endsWith(".kfpkg", ignoreCase = true)
            val filesList = if (isKfpkg) {
                emptyList()
            } else {
                listOf(
                    FirmwareFileItem(
                        name = fileName,
                        offsetHex = offsetHex,
                        downloadUrl = "",
                        localCachedPath = targetFile.absolutePath
                    )
                )
            }

            val pkg = FirmwarePackage(
                id = customId,
                nodeType = nodeType,
                displayName = "Local: $fileName ($nodeType)",
                version = version,
                chipType = chipType,
                description = "Manually imported from device storage",
                files = filesList,
                packageUrl = null,
                isCachedLocally = true,
                localPath = targetFile.absolutePath
            )

            // Save to DB
            cachedDao.insertOrUpdate(
                CachedFirmwareEntity(
                    id = pkg.id,
                    nodeType = pkg.nodeType,
                    displayName = pkg.displayName,
                    version = pkg.version,
                    chipType = pkg.chipType,
                    description = pkg.description,
                    localFilesJson = gson.toJson(pkg.files),
                    packageLocalPath = pkg.localPath,
                    downloadTimestamp = System.currentTimeMillis(),
                    isUserImported = true
                )
            )

            return@withContext Resource.Success(pkg)
        } catch (e: Exception) {
            return@withContext Resource.Error("Failed to import local firmware: ${e.message}", e)
        }
    }

    private fun queryFileName(uri: Uri): String? {
        var name: String? = null
        if (uri.scheme == "content") {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        name = cursor.getString(index)
                    }
                }
            }
        }
        if (name == null) {
            name = uri.path?.let { p ->
                val cut = p.lastIndexOf('/')
                if (cut != -1) p.substring(cut + 1) else p
            }
        }
        return name
    }
}

