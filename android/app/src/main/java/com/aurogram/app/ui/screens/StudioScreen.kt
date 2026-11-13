package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import com.aurogram.app.ui.theme.LocalAurogramTheme
import com.aurogram.app.ui.theme.glassSurface

private data class StudioTool(val title: String, val hint: String, val badge: String = "")

private val studioTools = listOf(
    StudioTool("HTML-Виджеты", "Игры и опросы для постов", "42"),
    StudioTool("Стикеры", "Вырезание фона и стикерпаки"),
    StudioTool("Медиа-библиотека", "Фото и видео канала"),
    StudioTool("Отложенные посты", "Календарь публикаций"),
)

/**
 * Экран «Студия» — заготовка мобильного Channel Studio.
 * Полный набор инструментов пока живёт в вебе, здесь — панель разделов.
 */
@Composable
fun StudioScreen(
    channelId: Long,
    channelTitle: String,
    onBack: () -> Unit,
) {
    val colors = LocalAurogramColors.current
    val theme = LocalAurogramTheme.current

    Column(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
            BasicText(
                text = "‹  Канал",
                modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp),
                style = AurogramTypography.Label.copy(color = colors.muted),
            )
            Spacer(Modifier.height(8.dp))
            BasicText("Студия", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.height(4.dp))
            BasicText(
                text = "$channelTitle · ${theme.label}",
                style = AurogramTypography.Mono.copy(color = colors.muted),
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            items(studioTools) { tool -> StudioToolCard(tool) }
            item {
                Spacer(Modifier.height(6.dp))
                BasicText(
                    text = "Веб-версия Студии уже собирает HTML-виджеты, стикеры и расписание. " +
                        "Мобильный экран — заготовка: скоро сюда переедет та же панель инструментов.",
                    style = AurogramTypography.Label.copy(color = colors.muted),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
                Spacer(Modifier.height(6.dp))
                BasicText(
                    text = "CHANNEL / $channelId",
                    style = AurogramTypography.Mono.copy(color = colors.muted),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun StudioToolCard(tool: StudioTool) {
    val colors = LocalAurogramColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .glassSurface(colors, AurogramShapes.Card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            BasicText(tool.title, style = AurogramTypography.Title.copy(color = colors.ink))
            Spacer(Modifier.height(4.dp))
            BasicText(tool.hint, style = AurogramTypography.Label.copy(color = colors.muted))
        }
        if (tool.badge.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .clip(AurogramShapes.Control)
                    .background(colors.accent.copy(alpha = 0.16f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                BasicText(tool.badge, style = AurogramTypography.Mono.copy(color = colors.accent))
            }
        }
    }
}
