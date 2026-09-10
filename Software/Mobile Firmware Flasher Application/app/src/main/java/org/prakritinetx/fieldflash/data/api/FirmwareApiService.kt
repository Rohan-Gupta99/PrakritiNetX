package org.prakritinetx.fieldflash.data.api

import okhttp3.ResponseBody
import org.prakritinetx.fieldflash.data.models.FirmwareManifest
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Streaming
import retrofit2.http.Url

interface FirmwareApiService {
    @GET("firmware/manifest")
    suspend fun getFirmwareManifest(): Response<FirmwareManifest>

    @Streaming
    @GET
    suspend fun downloadFirmwareFile(@Url fileUrl: String): Response<ResponseBody>
}

