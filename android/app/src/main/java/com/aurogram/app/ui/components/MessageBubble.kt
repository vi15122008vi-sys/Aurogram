package com.aurogram.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.MessageDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun MessageBubble(
    message: MessageDto,
    snackbar: AurogramSnackbarState,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val fill = if (message.out) colors.accent.copy(alpha = 0.08f) else colors.surface
    Column(
        modifier = Modifier
            .fillMaxWidth(0.88f)
            .background(fill, AurogramShapes.Panel)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (!message.out && !message.senderName.isNullOrBlank()) {
            BasicText(message.senderName, style = AurogramTypography.Label.copy(color = colors.accent))
        }
        if (!message.text.isNullOrBlank()) {
            BasicText(message.text, style = AurogramTypography.Body.copy(color = colors.ink))
        }
        when (message.mediaType) {
            "voice" -> VoicePlayer(message = message, snackbar = snackbar, api = api)
            null -> Unit
            else -> BasicText("Медиа · ${message.mediaType}", style = AurogramTypography.Label.copy(color = colors.muted))
        }
        BasicText(message.date.take(16).replace('T', ' '), style = AurogramTypography.Mono.copy(color = colors.muted))
    }
}