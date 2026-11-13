package com.aurogram.app.ui.theme

import androidx.compose.ui.graphics.Color

object AurogramColorTokens {
    val Canvas = Color(0xFFF5F5F7)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceRaised = Color(0xFFFAFAFA)
    val Ink = Color(0xFF18181B)
    val Muted = Color(0xFF71717A)
    val Border = Color(0xFFE4E4E7)
    val Accent = Color(0xFF6366F1)
    val AccentStrong = Color(0xFF4F46E5)
    val Success = Color(0xFF15803D)
    val Warning = Color(0xFFB45309)
    val Danger = Color(0xFFB91C1C)
    val Ghost = Color(0xFF7C3AED)
}

/** Наборы тем повторяют web/src/lib/themes.ts (те же HEX-коды). */
enum class AurogramThemeId(val key: String, val label: String, val dark: Boolean) {
    AurogramDark("aurogram", "Aurogram Dark", true),
    LiquidGlass("liquid-glass", "Liquid Glass", true),
    Orange("orange", "Orange", true),
    Halloween("halloween", "Halloween", true),
    Paper("paper", "Paper", false),
    Mint("mint", "Mint", false),
    Sky("sky", "Sky", false),
    Ghost("ghost", "Ghost", true),
    Midnight("midnight", "Midnight", true),
    Ocean("ocean", "Ocean", true),
    Sunset("sunset", "Sunset", true),
    ;

    companion object {
        fun fromKey(key: String?): AurogramThemeId =
            values().firstOrNull { it.key == key } ?: AurogramDark
    }
}

object AurogramPalettes {
    private val aurogramDark = AurogramColors(
        canvas = Color(0xFF0A0A0C),
        surface = Color(0xFF111114),
        surfaceRaised = Color(0xFF191920),
        ink = Color(0xFFFAFAFA),
        muted = Color(0xFFA1A1AA),
        border = Color(0x08FFFFFF),
        accent = Color(0xFF6366F1),
        accentStrong = Color(0xFF818CF8),
        success = Color(0xFF22C55E),
        warning = Color(0xFFF59E0B),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFA78BFA),
    )

    /** Liquid Glass: те же оттенки, но поверхности полупрозрачные (стекло). */
    private val liquidGlass = aurogramDark.copy(
        surface = Color(0x1FFFFFFF),
        surfaceRaised = Color(0x29FFFFFF),
        muted = Color(0xFFB4B4BD),
        border = Color(0x1AFFFFFF),
    )

    private val orange = AurogramColors(
        canvas = Color(0xFF1A0E05),
        surface = Color(0xFF261607),
        surfaceRaised = Color(0xFF341E0C),
        ink = Color(0xFFFFF6EC),
        muted = Color(0xFFC9A98C),
        border = Color(0x0AFFFFFF),
        accent = Color(0xFFF97316),
        accentStrong = Color(0xFFFB923C),
        success = Color(0xFF22C55E),
        warning = Color(0xFFFBBF24),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFC084FC),
    )

    private val halloween = AurogramColors(
        canvas = Color(0xFF150B22),
        surface = Color(0xFF1F1030),
        surfaceRaised = Color(0xFF2C1642),
        ink = Color(0xFFFBF5FF),
        muted = Color(0xFFB9A5CB),
        border = Color(0x0AFFFFFF),
        accent = Color(0xFFC026D3),
        accentStrong = Color(0xFFD946EF),
        success = Color(0xFF4ADE80),
        warning = Color(0xFFFDE047),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFFB923C),
    )

    private val paper = AurogramColors(
        canvas = Color(0xFFF7F7F8),
        surface = Color(0xFFFFFFFF),
        surfaceRaised = Color(0xFFF0F0F3),
        ink = Color(0xFF18181B),
        muted = Color(0xFF6B6B75),
        border = Color(0x0A18181B),
        accent = Color(0xFF18181B),
        accentStrong = Color(0xFF3F3F46),
        success = Color(0xFF15803D),
        warning = Color(0xFFB45309),
        danger = Color(0xFFB91C1C),
        ghost = Color(0xFF6D28D9),
    )

    private val mint = AurogramColors(
        canvas = Color(0xFFEAF6EF),
        surface = Color(0xFFFFFFFF),
        surfaceRaised = Color(0xFFDDEDE4),
        ink = Color(0xFF10241A),
        muted = Color(0xFF587264),
        border = Color(0x0A10241A),
        accent = Color(0xFF067A55),
        accentStrong = Color(0xFF056347),
        success = Color(0xFF15803D),
        warning = Color(0xFFB45309),
        danger = Color(0xFFB91C1C),
        ghost = Color(0xFF6D5BD0),
    )

    private val sky = AurogramColors(
        canvas = Color(0xFFECF4FB),
        surface = Color(0xFFFFFFFF),
        surfaceRaised = Color(0xFFDEEBF7),
        ink = Color(0xFF0F1E2B),
        muted = Color(0xFF557086),
        border = Color(0x0A0F1E2B),
        accent = Color(0xFF0284C7),
        accentStrong = Color(0xFF0369A1),
        success = Color(0xFF15803D),
        warning = Color(0xFFB45309),
        danger = Color(0xFFB91C1C),
        ghost = Color(0xFF6D5BD0),
    )

    private val ghost = AurogramColors(
        canvas = Color(0xFF101322),
        surface = Color(0xFF171B2E),
        surfaceRaised = Color(0xFF202640),
        ink = Color(0xFFF7F7FF),
        muted = Color(0xFFA8ABC2),
        border = Color(0x12FFFFFF),
        accent = Color(0xFF8B5CF6),
        accentStrong = Color(0xFFA78BFA),
        success = Color(0xFF22C55E),
        warning = Color(0xFFF59E0B),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFC4B5FD),
    )

    private val midnight = AurogramColors(
        canvas = Color(0xFF06080F),
        surface = Color(0xFF0C111C),
        surfaceRaised = Color(0xFF141B2A),
        ink = Color(0xFFF3F6FB),
        muted = Color(0xFF94A0B6),
        border = Color(0x08FFFFFF),
        accent = Color(0xFFEAB308),
        accentStrong = Color(0xFFFACC15),
        success = Color(0xFF22C55E),
        warning = Color(0xFFFDE047),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFA78BFA),
    )

    private val ocean = AurogramColors(
        canvas = Color(0xFF04121A),
        surface = Color(0xFF0A1E29),
        surfaceRaised = Color(0xFF112D3B),
        ink = Color(0xFFE9F9FF),
        muted = Color(0xFF8CAEBD),
        border = Color(0x09FFFFFF),
        accent = Color(0xFF0891B2),
        accentStrong = Color(0xFF06B6D4),
        success = Color(0xFF22C55E),
        warning = Color(0xFFF59E0B),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFA78BFA),
    )

    private val sunset = AurogramColors(
        canvas = Color(0xFF140710),
        surface = Color(0xFF1F0C18),
        surfaceRaised = Color(0xFF2C1222),
        ink = Color(0xFFFFF4F8),
        muted = Color(0xFFC3A2B0),
        border = Color(0x09FFFFFF),
        accent = Color(0xFFE11D48),
        accentStrong = Color(0xFFFB7185),
        success = Color(0xFF22C55E),
        warning = Color(0xFFFBBF24),
        danger = Color(0xFFEF4444),
        ghost = Color(0xFFC4B5FD),
    )

    fun of(themeId: AurogramThemeId): AurogramColors = when (themeId) {
        AurogramThemeId.AurogramDark -> aurogramDark
        AurogramThemeId.LiquidGlass -> liquidGlass
        AurogramThemeId.Orange -> orange
        AurogramThemeId.Halloween -> halloween
        AurogramThemeId.Paper -> paper
        AurogramThemeId.Mint -> mint
        AurogramThemeId.Sky -> sky
        AurogramThemeId.Ghost -> ghost
        AurogramThemeId.Midnight -> midnight
        AurogramThemeId.Ocean -> ocean
        AurogramThemeId.Sunset -> sunset
    }
}
