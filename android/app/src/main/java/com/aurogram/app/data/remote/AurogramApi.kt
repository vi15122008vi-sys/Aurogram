package com.aurogram.app.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

@JsonClass(generateAdapter = false)
data class ChannelDto(
    val id: Long,
    val title: String,
    val username: String? = null,
    val subscribers: Int = 0,
    @Json(name = "posts_count") val postsCount: Int = 0,
    @Json(name = "scheduled_count") val scheduledCount: Int = 0,
    @Json(name = "last_post_at") val lastPostAt: String? = null,
)

@JsonClass(generateAdapter = false)
data class ChannelDetailDto(
    val id: Long,
    val title: String,
    val username: String? = null,
    val subscribers: Int = 0,
    val about: String = "",
    @Json(name = "linked_chat_id") val linkedChatId: Long? = null,
)

@JsonClass(generateAdapter = false)
data class BotDto(
    val id: Long,
    val username: String,
    val name: String,
    @Json(name = "webhook_set") val webhookSet: Boolean = false,
)

@JsonClass(generateAdapter = false)
data class BotCreateDto(val token: String, @Json(name = "webhook_url") val webhookUrl: String? = null)

@JsonClass(generateAdapter = false)
data class WebhookUpdateDto(val url: String? = null)

@JsonClass(generateAdapter = false)
data class ChatDto(
    val id: Long,
    val title: String,
    val username: String? = null,
    val type: String,
    val unread: Int = 0,
    @Json(name = "last_message") val lastMessage: String? = null,
    @Json(name = "last_message_date") val lastMessageDate: String? = null,
    val ghost: Boolean = false,
)

@JsonClass(generateAdapter = false)
data class MessageDto(
    val id: Long,
    @Json(name = "chat_id") val chatId: Long,
    @Json(name = "sender_id") val senderId: Long? = null,
    @Json(name = "sender_name") val senderName: String? = null,
    val text: String? = null,
    val date: String,
    val out: Boolean = false,
    val status: String = "sent",
    val edited: Boolean = false,
    val deleted: Boolean = false,
    @Json(name = "media_type") val mediaType: String? = null,
    @Json(name = "media_url") val mediaUrl: String? = null,
    val duration: Int? = null,
    @Json(name = "waveform_data") val waveformData: List<Int>? = null,
)

@JsonClass(generateAdapter = false)
data class MessageCreateDto(@Json(name = "chat_id") val chatId: Long, val text: String, @Json(name = "parse_mode") val parseMode: String = "html")

@JsonClass(generateAdapter = false)
data class StopWordDto(
    val id: Long? = null,
    val word: String,
    val category: String = "custom",
    val enabled: Boolean = true,
    @Json(name = "is_regex") val isRegex: Boolean = false,
    @Json(name = "is_builtin") val isBuiltin: Boolean = false,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
)

@JsonClass(generateAdapter = false)
data class StopWordCreateDto(val word: String, val category: String, @Json(name = "is_regex") val isRegex: Boolean)

@JsonClass(generateAdapter = false)
data class StopWordPatchDto(val word: String? = null, val category: String? = null, val enabled: Boolean? = null)

@JsonClass(generateAdapter = false)
data class StopWordImportDto(val format: String, val data: String, val category: String = "custom")

@JsonClass(generateAdapter = false)
data class ImportResultDto(val imported: Int, val skipped: Int)

@JsonClass(generateAdapter = false)
data class AntispamSettingsDto(
    val enabled: Boolean = false,
    val level: String = "soft",
    @Json(name = "stop_words_builtin_disabled") val stopWordsBuiltinDisabled: List<String> = emptyList(),
    @Json(name = "stop_words_custom") val stopWordsCustom: List<String> = emptyList(),
    val stem: Boolean = true,
    @Json(name = "case_sensitive") val caseSensitive: Boolean = false,
    @Json(name = "exact_match") val exactMatch: Boolean = false,
    @Json(name = "links_policy") val linksPolicy: String = "blacklist_only",
    @Json(name = "allowlist_custom") val allowlistCustom: List<String> = emptyList(),
    @Json(name = "allowlist_global_disabled") val allowlistGlobalDisabled: List<String> = emptyList(),
    @Json(name = "allow_subdomains") val allowSubdomains: Boolean = true,
    @Json(name = "allow_raw_ip") val allowRawIp: Boolean = false,
    @Json(name = "allow_shortlinks") val allowShortlinks: Boolean = false,
    @Json(name = "flood_enabled") val floodEnabled: Boolean = false,
    @Json(name = "flood_threshold") val floodThreshold: Int = 5,
    @Json(name = "flood_window_sec") val floodWindowSec: Int = 10,
    @Json(name = "caps_enabled") val capsEnabled: Boolean = false,
    @Json(name = "caps_ratio") val capsRatio: Float = 0.7f,
    @Json(name = "caps_min_len") val capsMinLen: Int = 20,
    @Json(name = "emoji_enabled") val emojiEnabled: Boolean = false,
    @Json(name = "emoji_max") val emojiMax: Int = 10,
    @Json(name = "new_user_probation_hours") val newUserProbationHours: Int = 0,
    @Json(name = "duplicate_window_min") val duplicateWindowMin: Int = 0,
    @Json(name = "notify_author_dm") val notifyAuthorDm: Boolean = true,
    @Json(name = "mute_on_repeat") val muteOnRepeat: Boolean = false,
    @Json(name = "mute_minutes") val muteMinutes: Int = 5,
    @Json(name = "ban_on_third") val banOnThird: Boolean = false,
    @Json(name = "check_in_media_captions") val checkInMediaCaptions: Boolean = true,
)

@JsonClass(generateAdapter = false)
data class AntispamMetricsDto(val deleted: Int = 0, val mutes: Int = 0, val bans: Int = 0)

@JsonClass(generateAdapter = false)
data class AntispamTestRequestDto(val text: String, @Json(name = "is_caption") val isCaption: Boolean = false)

@JsonClass(generateAdapter = false)
data class VerdictDto(val action: String, val reason: String? = null, val matched: List<String> = emptyList())

@JsonClass(generateAdapter = false)
data class PostCreateDto(
    val text: String,
    @Json(name = "parse_mode") val parseMode: String = "md",
    @Json(name = "schedule_at") val scheduleAt: String? = null,
    val silent: Boolean = false,
)

@JsonClass(generateAdapter = false)
data class EditorPreviewRequestDto(val markdown: String, val premium: Boolean = false)

@JsonClass(generateAdapter = false)
data class EditorPreviewDto(
    val ok: Boolean,
    val html: String? = null,
    val error: String? = null,
    val warnings: List<String> = emptyList(),
    @Json(name = "plain_length") val plainLength: Int = 0,
    @Json(name = "max_length") val maxLength: Int = 32768,
)

interface AurogramApi {
    @GET("channels")
    suspend fun getChannels(): List<ChannelDto>

    @GET("channels/{channelId}")
    suspend fun getChannel(@Path("channelId") channelId: Long): ChannelDetailDto

    @GET("channels/{channelId}/antispam")
    suspend fun getAntispamSettings(@Path("channelId") channelId: Long): AntispamSettingsDto

    @PUT("channels/{channelId}/antispam")
    suspend fun saveAntispamSettings(@Path("channelId") channelId: Long, @Body settings: AntispamSettingsDto): AntispamSettingsDto

    @GET("channels/{channelId}/antispam/metrics")
    suspend fun getAntispamMetrics(@Path("channelId") channelId: Long): AntispamMetricsDto

    @POST("channels/{channelId}/antispam/test")
    suspend fun testAntispam(@Path("channelId") channelId: Long, @Body request: AntispamTestRequestDto): VerdictDto

    @GET("channels/{channelId}/stopwords")
    suspend fun getStopWords(@Path("channelId") channelId: Long): List<StopWordDto>

    @POST("channels/{channelId}/stopwords")
    suspend fun addStopWord(@Path("channelId") channelId: Long, @Body request: StopWordCreateDto): StopWordDto

    @PATCH("channels/{channelId}/stopwords/{wordId}")
    suspend fun updateStopWord(@Path("channelId") channelId: Long, @Path("wordId") wordId: Long, @Body request: StopWordPatchDto): StopWordDto

    @DELETE("channels/{channelId}/stopwords/{wordId}")
    suspend fun deleteStopWord(@Path("channelId") channelId: Long, @Path("wordId") wordId: Long)

    @POST("channels/{channelId}/stopwords/import")
    suspend fun importStopWords(@Path("channelId") channelId: Long, @Body request: StopWordImportDto): ImportResultDto

    @GET("channels/{channelId}/stopwords/export")
    suspend fun exportStopWords(@Path("channelId") channelId: Long, @Query("format") format: String): ResponseBody

    @POST("editor/preview")
    suspend fun previewPost(@Body request: EditorPreviewRequestDto): EditorPreviewDto

    @POST("editor/channels/{channelId}/posts")
    suspend fun publishPost(@Path("channelId") channelId: Long, @Body request: PostCreateDto): MessageDto

    @GET("bots")
    suspend fun getBots(): List<BotDto>

    @POST("bots")
    suspend fun createBot(@Body request: BotCreateDto): BotDto

    @DELETE("bots/{botId}")
    suspend fun deleteBot(@Path("botId") botId: Long)

    @PUT("bots/{botId}/webhook")
    suspend fun updateWebhook(@Path("botId") botId: Long, @Body request: WebhookUpdateDto): BotDto

    @GET("chats")
    suspend fun getChats(@Query("limit") limit: Int = 100): List<ChatDto>

    @GET("messages")
    suspend fun getMessages(
        @Query("chat_id") chatId: Long,
        @Query("limit") limit: Int = 50,
        @Query("offset_id") offsetId: Long = 0,
        @Query("ghost") ghost: Boolean = true,
    ): List<MessageDto>

    @POST("messages")
    suspend fun sendMessage(@Body request: MessageCreateDto): MessageDto

    @Streaming
    @GET("messages/{chatId}/{messageId}/media")
    suspend fun getMessageMedia(@Path("chatId") chatId: Long, @Path("messageId") messageId: Long): ResponseBody
}