package com.aurogram.app.ui.screens

import android.annotation.SuppressLint
import android.graphics.Color
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.aurogram.app.BuildConfig
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import com.aurogram.app.ui.theme.LocalAurogramTheme
import com.aurogram.app.ui.theme.glassSurface

private data class WidgetPreset(val id: String, val title: String, val kind: String)

/** Каталог повторяет ключевые виджеты веб-Студии; HTML отдаёт бэкенд. */
private val widgetPresets = listOf(
    WidgetPreset("tic-tac-toe", "Крестики-нолики", "game"),
    WidgetPreset("quiz", "Викторина", "poll"),
    WidgetPreset("2048", "2048", "game"),
    WidgetPreset("minesweeper", "Сапер", "game"),
)

private data class StudioTool(val title: String, val hint: String, val badge: String = "")

private val studioTools = listOf(
    StudioTool("Стикеры", "Вырезание фона и стикерпаки"),
    StudioTool("Медиа-библиотека", "Фото и видео канала"),
    StudioTool("Отложенные посты", "Календарь публикаций"),
)

/**
 * «Студия» на Android: HTML-виджеты рендерятся в WebView с бэкенда
 * (`/api/widgets/{id}.html`), поэтому игры и опросы работают без нативного кода.
 */
@Composable
fun StudioScreen(
    channelId: Long,
    channelTitle: String,
    onBack: () -> Unit,
) {
    val colors = LocalAurogramColors.current
    val theme = LocalAurogramTheme.current
    var selectedIndex by remember { mutableIntStateOf(0) }
    val preset = widgetPresets[selectedIndex]

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

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            widgetPresets.forEachIndexed { index, item ->
                val active = index == selectedIndex
                Box(
                    modifier = Modifier
                        .clip(AurogramShapes.Control)
                        .background(if (active) colors.accent.copy(alpha = 0.18f) else colors.surface)
                        .clickable { selectedIndex = index }
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    BasicText(
                        text = item.title,
                        style = AurogramTypography.Label.copy(color = if (active) colors.accent else colors.muted),
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(380.dp)
                .glassSurface(colors, AurogramShapes.PanelLarge),
        ) {
            WidgetWebView(preset = preset, modifier = Modifier.fillMaxSize())
        }

        Spacer(Modifier.height(12.dp))

        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            studioTools.forEach { tool -> StudioToolCard(tool) }
            BasicText(
                text = "CHANNEL / $channelId",
                style = AurogramTypography.Mono.copy(color = colors.muted),
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
            )
        }
    }
}

/** WebView с адаптивным масштабом: страница сама подстраивается под ширину. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun WidgetWebView(preset: WidgetPreset, modifier: Modifier = Modifier) {
    val url = remember(preset) {
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        "$base/widgets/${preset.id}.html?title=${Uri.encode(preset.title)}&kind=${preset.kind}"
    }
    var webView by remember { mutableStateOf<WebView?>(null) }

    AndroidView(
        modifier = modifier.clip(RoundedCornerShape(24.dp)),
        factory = { context ->
            WebView(context).apply {
                setBackgroundColor(Color.TRANSPARENT)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                settings.builtInZoomControls = false
                settings.displayZoomControls = false
                webViewClient = WebViewClient()
                tag = url
                loadUrl(url)
                webView = this
            }
        },
        update = { view ->
            // Перезагружаем только при смене виджета, иначе WebView дёргался бы на каждый кадр.
            if (view.tag != url) {
                view.tag = url
                view.loadUrl(url)
            }
        },
    )

    DisposableEffect(Unit) {
        onDispose {
            webView?.destroy()
            webView = null
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
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            BasicText(tool.title, style = AurogramTypography.Title.copy(color = colors.ink))
            Spacer(Modifier.height(3.dp))
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
