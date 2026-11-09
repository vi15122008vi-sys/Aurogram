package com.aurogram.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun AurogramTabRow(tabs: List<String>, selectedIndex: Int, onSelect: (Int) -> Unit) {
    val colors = LocalAurogramColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEachIndexed { index, label ->
            val selected = selectedIndex == index
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onSelect(index) }
                    .padding(top = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BasicText(
                    text = label,
                    style = AurogramTypography.Label.copy(color = if (selected) colors.accent else colors.muted),
                    maxLines = 1,
                )
                Box(
                    modifier = Modifier
                        .padding(top = 10.dp)
                        .fillMaxWidth(0.72f)
                        .height(2.dp)
                        .clip(RoundedCornerShape(1.dp))
                        .background(if (selected) colors.accent else colors.surface),
                )
            }
        }
    }
}