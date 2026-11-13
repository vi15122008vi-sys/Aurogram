package com.aurogram.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.aurogram.app.ui.navigation.NavGraph
import com.aurogram.app.ui.screens.SplashScreen
import com.aurogram.app.ui.theme.AurogramTheme
import com.aurogram.app.ui.theme.AurogramThemeId
import com.aurogram.app.ui.theme.ThemePreference

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        setContent {
            var themeKey by rememberSaveable { mutableStateOf(ThemePreference.read(context).key) }
            val themeId = AurogramThemeId.fromKey(themeKey)

            AurogramTheme(themeId = themeId) {
                var showSplash by rememberSaveable { mutableStateOf(true) }
                if (showSplash) {
                    SplashScreen(onFinished = { showSplash = false })
                } else {
                    NavGraph(
                        themeId = themeId,
                        onThemeChange = { next ->
                            themeKey = next.key
                            ThemePreference.write(context, next)
                        },
                    )
                }
            }
        }
    }
}
