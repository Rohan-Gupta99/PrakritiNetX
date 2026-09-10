package org.prakritinetx.fieldflash.data.api

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.prakritinetx.fieldflash.core.Constants
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient private constructor(context: Context) {

    private val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var currentBaseUrl: String = getStoredBaseUrl()
    private var retrofit: Retrofit = buildRetrofit(currentBaseUrl)

    var firmwareApi: FirmwareApiService = retrofit.create(FirmwareApiService::class.java)
        private set

    var locationApi: LocationApiService = retrofit.create(LocationApiService::class.java)
        private set

    fun getStoredBaseUrl(): String {
        var url = prefs.getString(Constants.KEY_BACKEND_URL, Constants.DEFAULT_BASE_URL)
            ?: Constants.DEFAULT_BASE_URL
        if (!url.endsWith("/")) {
            url += "/"
        }
        return url
    }

    fun updateBaseUrl(newUrl: String) {
        var normalizedUrl = newUrl.trim()
        if (!normalizedUrl.endsWith("/")) {
            normalizedUrl += "/"
        }
        prefs.edit().putString(Constants.KEY_BACKEND_URL, normalizedUrl).apply()
        currentBaseUrl = normalizedUrl
        retrofit = buildRetrofit(currentBaseUrl)
        firmwareApi = retrofit.create(FirmwareApiService::class.java)
        locationApi = retrofit.create(LocationApiService::class.java)
    }

    private fun buildRetrofit(baseUrl: String): Retrofit {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    companion object {
        @Volatile
        private var INSTANCE: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ApiClient(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}

