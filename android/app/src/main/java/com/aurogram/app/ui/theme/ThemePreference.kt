package com.aurogram.app.ui.theme

import android.content.Context

/** Сохраняет выбранную тему между запусками (SharedPreferences). */
object ThemePreference {
    private const val PREFS = "aurogram.theme"
    private const val KEY = "theme_id"

    fun read(context: Context): AurogramThemeId {
        val stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
        return AurogramThemeId.fromKey(stored)
    }

    fun write(context: Context, themeId: AurogramThemeId) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, themeId.key)
            .apply()
    }
}
