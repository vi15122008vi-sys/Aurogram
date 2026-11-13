package com.aurogram.app.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/**
 * «Стеклянная» плитка: полупрозрачная заливка темы + волосяная кромка
 * вместо жёсткой обводки. Работает с любым палитрой, включая Liquid Glass.
 */
fun Modifier.glassSurface(
    colors: AurogramColors,
    shape: Shape = AurogramShapes.PanelLarge,
): Modifier = this
    .clip(shape)
    .background(colors.surface)
    .border(0.6.dp, colors.border, shape)
