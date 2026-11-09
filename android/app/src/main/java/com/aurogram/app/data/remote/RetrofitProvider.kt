package com.aurogram.app.data.remote

import com.aurogram.app.BuildConfig
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class MemoryCookieJar : CookieJar {
    private val storedCookies = mutableListOf<Cookie>()

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        storedCookies.removeAll { old -> cookies.any { fresh -> old.name == fresh.name && old.domain == fresh.domain && old.path == fresh.path } }
        storedCookies.addAll(cookies.filterNot { it.expiresAt < System.currentTimeMillis() })
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        storedCookies.removeAll { it.expiresAt < System.currentTimeMillis() }
        return storedCookies.filter { it.matches(url) }
    }
}

object RetrofitProvider {
    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val client = OkHttpClient.Builder()
        .cookieJar(MemoryCookieJar())
        .build()

    val api: AurogramApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(AurogramApi::class.java)
    }
}