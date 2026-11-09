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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.ChannelDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun ChannelsScreen(
    onOpenChannel: (Long) -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    var channels by remember { mutableStateOf<List<ChannelDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        loading = true
        try {
            channels = api.getChannels()
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        } finally {
            loading = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                Column {
                    BasicText("PUBLISHING", style = AurogramTypography.Mono.copy(color = colors.accent))
                    Spacer(Modifier.size(6.dp))
                    BasicText("Каналы", style = AurogramTypography.Display.copy(color = colors.ink))
                }
                BasicText(
                    text = "Обновить",
                    modifier = Modifier
                        .clip(AurogramShapes.Control)
                        .clickable { reload += 1 }
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    style = AurogramTypography.Label.copy(color = colors.accent),
                )
            }
            Spacer(Modifier.size(20.dp))
            when {
                loading && channels.isEmpty() -> BasicText("Загружаем каналы…", style = AurogramTypography.Body.copy(color = colors.muted))
                channels.isEmpty() -> EmptyState(title = "Каналов пока нет", description = "Каналы с правами администратора появятся здесь.")
                else -> LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(channels, key = { it.id }) { channel ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(AurogramShapes.Panel)
                                .background(colors.surface)
                                .clickable { onOpenChannel(channel.id) }
                                .padding(16.dp),
                        ) {
                            BasicText(channel.title, style = AurogramTypography.Title.copy(color = colors.ink))
                            Spacer(Modifier.size(4.dp))
                            BasicText(
                                text = channel.username?.let { "@$it" } ?: "ID ${channel.id}",
                                style = AurogramTypography.Mono.copy(color = colors.muted),
                            )
                            Spacer(Modifier.size(12.dp))
                            BasicText(
                                text = "${channel.subscribers} подписчиков  ·  ${channel.postsCount} постов",
                                style = AurogramTypography.Mono.copy(color = colors.muted),
                            )
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
internal fun EmptyState(title: String, description: String) {
    val colors = LocalAurogramColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(AurogramShapes.Panel)
            .background(colors.surface)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BasicText(title, style = AurogramTypography.Title.copy(color = colors.ink))
        Spacer(Modifier.size(8.dp))
        BasicText(description, style = AurogramTypography.Body.copy(color = colors.muted))
    }
}