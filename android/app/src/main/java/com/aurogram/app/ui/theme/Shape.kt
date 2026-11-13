package com.aurogram.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

object AurogramShapes {
    val Control: Shape = RoundedCornerShape(8.dp)
    val Panel: Shape = RoundedCornerShape(12.dp)

    /* Liquid Glass: карточки 20, панели/острова 24–26, модалки 28. */
    val Card: Shape = RoundedCornerShape(20.dp)
    val PanelLarge: Shape = RoundedCornerShape(24.dp)
    val Island: Shape = RoundedCornerShape(26.dp)
    val Modal: Shape = RoundedCornerShape(28.dp)
}
