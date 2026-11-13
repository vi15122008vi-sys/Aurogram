package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.aurogram.app.ui.theme.AurogramPalettes
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramThemeId
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import com.aurogram.app.ui.theme.glassSurface

/** Выбор темы: те же названия и оттенки, что в веб-версии. */
@Composable
fun SettingsScreen(
    themeId: AurogramThemeId,
    onThemeChange: (AurogramThemeId) -> Unit,
) {
    val colors = LocalAurogramColors.current

    Column(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
            BasicText("PREFERENCES", style = AurogramTypography.Mono.copy(color = colors.accent))
            Spacer(Modifier.height(8.dp))
            BasicText("Настройки", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.height(4.dp))
            BasicText(
                text = "Тема применяется сразу и сохраняется на устройстве.",
                style = AurogramTypography.Label.copy(color = colors.muted),
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item {
                BasicText(
                    text = "Тема",
                    style = AurogramTypography.Label.copy(color = colors.muted),
                    modifier = Modifier.padding(bottom = 2.dp),
                )
            }
            items(AurogramThemeId.values().toList()) { theme ->
                val palette = AurogramPalettes.of(theme)
                val selected = theme == themeId
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .glassSurface(colors, AurogramShapes.Card)
                        .clickable { onThemeChange(theme) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(palette.accent),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        BasicText(theme.label, style = AurogramTypography.Title.copy(color = colors.ink))
                        Spacer(Modifier.height(2.dp))
                        BasicText(
                            text = if (theme.dark) "тёмная · ${theme.key}" else "светлая · ${theme.key}",
                            style = AurogramTypography.Mono.copy(color = colors.muted),
                        )
                    }
                    if (selected) {
                        BasicText("✓", style = AurogramTypography.Title.copy(color = colors.accent))
                    }
                }
            }
        }
    }
}
