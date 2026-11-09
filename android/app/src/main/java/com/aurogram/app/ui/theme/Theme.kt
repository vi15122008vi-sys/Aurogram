package com.aurogram.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

data class AurogramColors(
    val canvas: androidx.compose.ui.graphics.Color,
    val surface: androidx.compose.ui.graphics.Color,
    val surfaceRaised: androidx.compose.ui.graphics.Color,
    val ink: androidx.compose.ui.graphics.Color,
    val muted: androidx.compose.ui.graphics.Color,
    val border: androidx.compose.ui.graphics.Color,
    val accent: androidx.compose.ui.graphics.Color,
    val accentStrong: androidx.compose.ui.graphics.Color,
    val success: androidx.compose.ui.graphics.Color,
    val warning: androidx.compose.ui.graphics.Color,
    val danger: androidx.compose.ui.graphics.Color,
    val ghost: androidx.compose.ui.graphics.Color,
)

val LocalAurogramColors = staticCompositionLocalOf {
    AurogramColors(
        canvas = AurogramColorTokens.Canvas,
        surface = AurogramColorTokens.Surface,
        surfaceRaised = AurogramColorTokens.SurfaceRaised,
        ink = AurogramColorTokens.Ink,
        muted = AurogramColorTokens.Muted,
        border = AurogramColorTokens.Border,
        accent = AurogramColorTokens.Accent,
        accentStrong = AurogramColorTokens.AccentStrong,
        success = AurogramColorTokens.Success,
        warning = AurogramColorTokens.Warning,
        danger = AurogramColorTokens.Danger,
        ghost = AurogramColorTokens.Ghost,
    )
}

@Composable
fun AurogramTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAurogramColors provides LocalAurogramColors.current) {
        content()
    }
}