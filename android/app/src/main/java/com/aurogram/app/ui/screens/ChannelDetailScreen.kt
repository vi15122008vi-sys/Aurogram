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
//import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.AntispamMetricsDto
import com.aurogram.app.data.remote.ChannelDetailDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.AurogramTabRow
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

private val channelTabs = listOf("Посты", "Статистика", "Антиспам", "Настройки")

@Composable
fun ChannelDetailScreen(
    channelId: Long,
    onBack: () -> Unit,
    onOpenPostEditor: (Long) -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    var channel by remember(channelId) { mutableStateOf<ChannelDetailDto?>(null) }
    var metrics by remember(channelId) { mutableStateOf<AntispamMetricsDto?>(null) }
    var selectedTab by remember(channelId) { mutableIntStateOf(0) }

    LaunchedEffect(channelId) {
        try {
            channel = api.getChannel(channelId)
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        }
    }
    LaunchedEffect(channelId, selectedTab) {
        if (selectedTab == 1) {
            try {
                metrics = api.getAntispamMetrics(channelId)
            } catch (error: Exception) {
                snackbar.showError(error.toAurogramMessage())
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
                BasicText("‹  Каналы", modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp), style = AurogramTypography.Label.copy(color = colors.muted))
                Spacer(Modifier.size(10.dp))
                BasicText(channel?.title ?: "Канал", style = AurogramTypography.Display.copy(color = colors.ink))
                Spacer(Modifier.size(4.dp))
                BasicText(channel?.username?.let { "@$it" } ?: "CHANNEL / $channelId", style = AurogramTypography.Mono.copy(color = colors.muted))
            }
            AurogramTabRow(channelTabs, selectedTab) { selectedTab = it }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (selectedTab) {
                0 -> Column(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    BasicText(
                        text = "Новый пост  +",
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(AurogramShapes.Control)
                            .background(colors.accent)
                            .clickable { onOpenPostEditor(channelId) }
                            .padding(14.dp),
                        style = AurogramTypography.Label.copy(color = colors.surface),
                    )
                    EmptyState("Публикации", "Откройте редактор, чтобы создать пост или запланировать публикацию.")
                }
                1 -> LazyColumn(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { MetricRow("Подписчики", channel?.subscribers?.toString() ?: "—") }
                    item { MetricRow("Удалено за 24 часа", metrics?.deleted?.toString() ?: "—") }
                    item { MetricRow("Муты", metrics?.mutes?.toString() ?: "—") }
                    item { MetricRow("Баны", metrics?.bans?.toString() ?: "—") }
                }
                2 -> AntispamScreen(channelId = channelId, api = api, snackbar = snackbar)
                else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { MetricRow("Username", channel?.username?.let { "@$it" } ?: "Не задан") }
                    item { MetricRow("Описание", channel?.about?.ifBlank { "Нет описания" } ?: "Загрузка…") }
                    item { MetricRow("Чат обсуждений", channel?.linkedChatId?.toString() ?: "Не привязан") }
                }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    val colors = LocalAurogramColors.current
    Row(
        modifier = Modifier.fillMaxWidth().clip(AurogramShapes.Panel).background(colors.surface).padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicText(label, style = AurogramTypography.Body.copy(color = colors.muted))
        BasicText(value, style = AurogramTypography.Mono.copy(color = colors.ink))
    }
}