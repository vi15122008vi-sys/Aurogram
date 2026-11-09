package com.aurogram.app.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aurogram.app.ui.theme.AurogramColorTokens
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val colors = LocalAurogramColors.current
    val transition = rememberInfiniteTransition(label = "splash-a")
    val alpha by transition.animateFloat(
        initialValue = 0.72f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(durationMillis = 850), repeatMode = RepeatMode.Reverse),
        label = "mark-alpha",
    )

    LaunchedEffect(Unit) {
        delay(1400)
        onFinished()
    }

    Box(
        modifier = Modifier.fillMaxSize().background(colors.canvas),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Canvas(modifier = Modifier.size(86.dp).alpha(alpha)) {
                val mark = Path().apply {
                    moveTo(size.width * 0.16f, size.height * 0.86f)
                    lineTo(size.width * 0.50f, size.height * 0.14f)
                    lineTo(size.width * 0.84f, size.height * 0.86f)
                    moveTo(size.width * 0.32f, size.height * 0.59f)
                    lineTo(size.width * 0.68f, size.height * 0.59f)
                }
                drawPath(
                    path = mark,
                    color = AurogramColorTokens.Accent,
                    style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            Spacer(modifier = Modifier.height(18.dp))
            BasicText(text = "Aurogram", style = AurogramTypography.Title.copy(color = colors.ink, fontSize = 20.sp))
        }
    }
}