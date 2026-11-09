package com.aurogram.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

data class NavItem(val route: String, val label: String, val glyph: String)

val AurogramNavItems = listOf(
    NavItem("channels", "Каналы", "channels"),
    NavItem("bots", "Боты", "bots"),
    NavItem("chats", "Чаты", "chats"),
    NavItem("settings", "Настройки", "settings"),
)

@Composable
fun BottomNavBar(navController: NavHostController, destination: NavDestination?) {
    val colors = LocalAurogramColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        AurogramNavItems.forEach { item ->
            val route = destination?.route.orEmpty()
            val nestedSelected = item.route == "channels" && (route.startsWith("channel/") || route.startsWith("post/")) ||
                item.route == "bots" && route.startsWith("bot/") ||
                item.route == "chats" && route.startsWith("messages/")
            val selected = destination?.hierarchy?.any { it.route == item.route } == true || nestedSelected
            val tint = if (selected) colors.accent else colors.muted
            Column(
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp)
                    .background(if (selected) colors.accent.copy(alpha = 0.08f) else Color.Transparent, AurogramShapes.Control)
                    .clickable {
                        navController.navigate(item.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                    .padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                NavGlyph(name = item.glyph, tint = tint)
                BasicText(text = item.label, style = AurogramTypography.Label.copy(color = tint))
            }
        }
    }
}

@Composable
private fun NavGlyph(name: String, tint: Color) {
    Canvas(modifier = Modifier.size(width = 22.dp, height = 20.dp).padding(bottom = 2.dp)) {
        val stroke = Stroke(width = 1.7.dp.toPx(), cap = StrokeCap.Round)
        when (name) {
            "channels" -> {
                drawRoundRect(tint, topLeft = Offset(size.width * 0.12f, size.height * 0.12f), size = Size(size.width * 0.76f, size.height * 0.76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx()), style = stroke)
                drawLine(tint, Offset(size.width * 0.32f, size.height * 0.38f), Offset(size.width * 0.68f, size.height * 0.38f), strokeWidth = stroke.width, cap = StrokeCap.Round)
                drawLine(tint, Offset(size.width * 0.32f, size.height * 0.60f), Offset(size.width * 0.58f, size.height * 0.60f), strokeWidth = stroke.width, cap = StrokeCap.Round)
            }
            "bots" -> {
                drawCircle(tint, radius = size.minDimension * 0.17f, center = Offset(size.width * 0.5f, size.height * 0.30f), style = stroke)
                drawArc(tint, 205f, 130f, false, topLeft = Offset(size.width * 0.18f, size.height * 0.32f), size = Size(size.width * 0.64f, size.height * 0.58f), style = stroke)
            }
            "chats" -> {
                drawRoundRect(tint, topLeft = Offset(size.width * 0.10f, size.height * 0.10f), size = Size(size.width * 0.80f, size.height * 0.68f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx()), style = stroke)
                val tail = Path().apply { moveTo(size.width * 0.30f, size.height * 0.78f); lineTo(size.width * 0.24f, size.height * 0.94f); lineTo(size.width * 0.48f, size.height * 0.78f) }
                drawPath(tail, tint, style = stroke)
            }
            else -> {
                drawCircle(tint, radius = size.minDimension * 0.28f, style = stroke)
                drawCircle(tint, radius = size.minDimension * 0.09f)
                repeat(4) { index ->
                    val angle = index * 90f * (Math.PI.toFloat() / 180f)
                    val start = Offset(size.width * 0.5f + kotlin.math.cos(angle) * size.width * 0.34f, size.height * 0.5f + kotlin.math.sin(angle) * size.height * 0.34f)
                    val end = Offset(size.width * 0.5f + kotlin.math.cos(angle) * size.width * 0.44f, size.height * 0.5f + kotlin.math.sin(angle) * size.height * 0.44f)
                    drawLine(tint, start, end, strokeWidth = stroke.width, cap = StrokeCap.Round)
                }
            }
        }
    }
}