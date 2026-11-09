package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun RootScreen(title: String, kicker: String, emptyText: String) {
    val colors = LocalAurogramColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.canvas)
            .padding(horizontal = 20.dp, vertical = 24.dp),
    ) {
        BasicText(text = kicker, style = AurogramTypography.Mono.copy(color = colors.accent))
        Spacer(modifier = Modifier.height(8.dp))
        BasicText(text = title, style = AurogramTypography.Display.copy(color = colors.ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(modifier = Modifier.height(24.dp))
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(colors.surface, AurogramShapes.Panel)
                .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(colors.surfaceRaised, AurogramShapes.Control),
                )
                Spacer(modifier = Modifier.height(14.dp))
                BasicText(text = emptyText, style = AurogramTypography.Title.copy(color = colors.ink))
            }
        }
    }
}