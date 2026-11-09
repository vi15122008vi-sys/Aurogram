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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AurogramTheme {
                var showSplash by rememberSaveable { mutableStateOf(true) }
                if (showSplash) {
                    SplashScreen(onFinished = { showSplash = false })
                } else {
                    NavGraph()
                }
            }
        }
    }
}