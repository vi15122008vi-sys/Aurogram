package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.BotDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.data.remote.WebhookUpdateDto
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch

@Composable
fun BotDetailScreen(
    botId: Long,
    onBack: () -> Unit,
    onRemoved: () -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    val scope = rememberCoroutineScope()
    var bot by remember(botId) { mutableStateOf<BotDto?>(null) }
    var webhook by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(botId) {
        try {
            bot = api.getBots().firstOrNull { it.id == botId }
            if (bot == null) snackbar.showError("Бот не найден")
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            BasicText("‹  Боты", modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp), style = AurogramTypography.Label.copy(color = colors.muted))
            Spacer(Modifier.size(16.dp))
            BasicText(bot?.name ?: "Бот", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.size(4.dp))
            BasicText(bot?.username?.let { "@$it" } ?: "Загрузка…", style = AurogramTypography.Mono.copy(color = colors.muted))
            Spacer(Modifier.size(22.dp))
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
                BasicText("Webhook", style = AurogramTypography.Title.copy(color = colors.ink))
                Spacer(Modifier.size(10.dp))
                BasicTextField(
                    value = webhook,
                    onValueChange = { webhook = it },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    decorationBox = { inner -> if (webhook.isBlank()) BasicText("https://example.com/webhook", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
                Spacer(Modifier.size(12.dp))
                BasicText(
                    text = if (busy) "Сохраняем…" else "Сохранить webhook",
                    modifier = Modifier.background(colors.accent, AurogramShapes.Control).clickable(enabled = !busy) {
                        busy = true
                        scope.launch {
                            try {
                                bot = api.updateWebhook(botId, WebhookUpdateDto(webhook.trim().ifBlank { null }))
                                snackbar.showSuccess("Webhook обновлён")
                            } catch (error: Exception) {
                                snackbar.showError(error.toAurogramMessage())
                            } finally {
                                busy = false
                            }
                        }
                    }.padding(12.dp),
                    style = AurogramTypography.Label.copy(color = colors.surface),
                )
            }
            Spacer(Modifier.size(14.dp))
            BasicText(
                "Удалить бота",
                modifier = Modifier.background(colors.surface, AurogramShapes.Control).clickable(enabled = !busy) {
                    busy = true
                    scope.launch {
                        try {
                            api.deleteBot(botId)
                            onRemoved()
                        } catch (error: Exception) {
                            snackbar.showError(error.toAurogramMessage())
                        } finally {
                            busy = false
                        }
                    }
                }.padding(13.dp),
                style = AurogramTypography.Label.copy(color = colors.danger),
            )
        }
        SnackbarHost(snackbar, Modifier.align(androidx.compose.ui.Alignment.BottomCenter))
    }
}