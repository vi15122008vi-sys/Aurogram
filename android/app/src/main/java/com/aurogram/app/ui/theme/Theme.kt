package com.aurogram.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class AurogramColors(
    val canvas: Color,
    val surface: Color,
    val surfaceRaised: Color,
    val ink: Color,
    val muted: Color,
    val border: Color,
    val accent: Color,
    val accentStrong: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
    val ghost: Color,
)

val LocalAurogramColors = staticCompositionLocalOf { AurogramPalettes.of(AurogramThemeId.AurogramDark) }

val LocalAurogramTheme = staticCompositionLocalOf { AurogramThemeId.AurogramDark }

val LocalAurogramColorsIsDark = staticCompositionLocalOf { true }

@Composable
fun AurogramTheme(
    themeId: AurogramThemeId = AurogramThemeId.AurogramDark,
    content: @Composable () -> Unit,
) {
    val palette = AurogramPalettes.of(themeId)
    CompositionLocalProvider(
        LocalAurogramColors provides palette,
        LocalAurogramTheme provides themeId,
        LocalAurogramColorsIsDark provides themeId.dark,
    ) {
        content()
    }
}
