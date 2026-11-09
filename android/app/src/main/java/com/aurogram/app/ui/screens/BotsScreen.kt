package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.aurogram.app.data.remote.BotCreateDto
import com.aurogram.app.data.remote.BotDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch

@Composable
fun BotsScreen(
    onOpenBot: (Long) -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    val scope = rememberCoroutineScope()
    var bots by remember { mutableStateOf<List<BotDto>>(emptyList()) }
    var token by remember { mutableStateOf("") }
    var webhook by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        try {
            bots = api.getBots()
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp)) {
            BasicText("AUTOMATION", style = AurogramTypography.Mono.copy(color = colors.accent))
            Spacer(Modifier.size(6.dp))
            BasicText("Боты", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.size(18.dp))
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
                BasicText("Подключить бота", style = AurogramTypography.Title.copy(color = colors.ink))
                Spacer(Modifier.size(10.dp))
                BasicTextField(
                    value = token,
                    onValueChange = { token = it },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = AurogramTypography.Mono.copy(color = colors.ink),
                    decorationBox = { inner -> if (token.isBlank()) BasicText("Bot token", style = AurogramTypography.Mono.copy(color = colors.muted)); inner() },
                )
                Spacer(Modifier.size(10.dp))
                BasicTextField(
                    value = webhook,
                    onValueChange = { webhook = it },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    decorationBox = { inner -> if (webhook.isBlank()) BasicText("Webhook URL (необязательно)", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
                Spacer(Modifier.size(10.dp))
                BasicText(
                    text = if (busy) "Подключаем…" else "Подключить",
                    modifier = Modifier.background(colors.accent, AurogramShapes.Control).clickable(enabled = !busy && token.isNotBlank()) {
                        busy = true
                        scope.launch {
                            try {
                                api.createBot(BotCreateDto(token.trim(), webhook.trim().ifBlank { null }))
                                token = ""
                                webhook = ""
                                reload += 1
                                snackbar.showSuccess("Бот подключён")
                            } catch (error: Exception) {
                                snackbar.showError(error.toAurogramMessage())
                            } finally {
                                busy = false
                            }
                        }
                    }.padding(horizontal = 14.dp, vertical = 10.dp),
                    style = AurogramTypography.Label.copy(color = colors.surface),
                )
            }
            Spacer(Modifier.size(18.dp))
            BasicText("Подключённые", style = AurogramTypography.Title.copy(color = colors.ink))
            Spacer(Modifier.size(8.dp))
            if (bots.isEmpty()) {
                EmptyState("Боты не подключены", "Добавьте токен, чтобы управлять ботом и webhook.")
            } else {
                LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(bots, key = { it.id }) { bot ->
                        Row(
                            modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).clickable { onOpenBot(bot.id) }.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column {
                                BasicText(bot.name.ifBlank { "@${bot.username}" }, style = AurogramTypography.Title.copy(color = colors.ink))
                                Spacer(Modifier.size(3.dp))
                                BasicText("@${bot.username}", style = AurogramTypography.Mono.copy(color = colors.muted))
                            }
                            BasicText(if (bot.webhookSet) "Webhook" else "Bot", style = AurogramTypography.Label.copy(color = colors.accent))
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(androidx.compose.ui.Alignment.BottomCenter))
    }
}