package com.aurogram.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.delay
import retrofit2.HttpException
import java.io.IOException
import org.json.JSONObject

data class SnackbarMessage(val text: String, val isError: Boolean)

class AurogramSnackbarState {
    var message by mutableStateOf<SnackbarMessage?>(null)
        private set

    fun showError(text: String) {
        message = SnackbarMessage(text, isError = true)
    }

    fun showSuccess(text: String) {
        message = SnackbarMessage(text, isError = false)
    }

    fun dismiss() {
        message = null
    }
}

fun Throwable.toAurogramMessage(): String = when (this) {
    is HttpException -> {
        val detail = runCatching { JSONObject(response()?.errorBody()?.string().orEmpty()).optString("detail") }.getOrNull()
        detail?.takeIf { it.isNotBlank() } ?: "Ошибка сервера (${code()})"
    }
    is IOException -> "Нет соединения с сервером"
    else -> message?.takeIf { it.isNotBlank() } ?: "Не удалось выполнить запрос"
}

@Composable
fun SnackbarHost(state: AurogramSnackbarState, modifier: Modifier = Modifier) {
    val message = state.message
    val colors = LocalAurogramColors.current
    if (message != null) {
        LaunchedEffect(message) {
            delay(3500)
            if (state.message == message) state.dismiss()
        }
        Row(
            modifier = modifier
                .fillMaxWidth()
                .padding(16.dp)
                .background(colors.ink, RoundedCornerShape(8.dp))
                .clickable { state.dismiss() }
                .padding(horizontal = 16.dp, vertical = 13.dp),
        ) {
            BasicText(
                text = message.text,
                style = AurogramTypography.Body.copy(color = if (message.isError) Color(0xFFFFD6D6) else Color.White),
            )
        }
    }
}