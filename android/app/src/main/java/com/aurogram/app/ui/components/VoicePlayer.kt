package com.aurogram.app.ui.components

import android.media.MediaPlayer
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.MessageDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun VoicePlayer(
    message: MessageDto,
    snackbar: AurogramSnackbarState,
    api: AurogramApi = RetrofitProvider.api,
) {
    val context = LocalContext.current
    val colors = LocalAurogramColors.current
    val scope = rememberCoroutineScope()
    var player by remember(message.id) { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember(message.id) { mutableStateOf(false) }
    var loading by remember(message.id) { mutableStateOf(false) }
    var progress by remember(message.id) { mutableFloatStateOf(0f) }
    var position by remember(message.id) { mutableIntStateOf(0) }

    DisposableEffect(player) {
        onDispose {
            player?.release()
            player = null
        }
    }

    LaunchedEffect(player, playing) {
        while (playing) {
            val activePlayer = player ?: break
            val duration = activePlayer.duration.coerceAtLeast(1)
            val current = activePlayer.currentPosition.coerceAtLeast(0)
            position = current / 1000
            progress = (current.toFloat() / duration).coerceIn(0f, 1f)
            delay(180)
        }
    }

    fun toggle() {
        val activePlayer = player
        if (activePlayer != null) {
            if (playing) {
                activePlayer.pause()
                playing = false
            } else {
                activePlayer.start()
                playing = true
            }
            return
        }
        if (loading) return
        loading = true
        scope.launch {
            try {
                val response = api.getMessageMedia(message.chatId, message.id)
                val bytes = withContext(Dispatchers.IO) { response.bytes() }
                val file = withContext(Dispatchers.IO) {
                    File(context.cacheDir, "voice-${message.chatId}-${message.id}.ogg").apply { writeBytes(bytes) }
                }
                val mediaPlayer = MediaPlayer()
                mediaPlayer.setDataSource(file.absolutePath)
                mediaPlayer.setOnPreparedListener { prepared ->
                    player = prepared
                    position = 0
                    progress = 0f
                    prepared.start()
                    playing = true
                    loading = false
                }
                mediaPlayer.setOnCompletionListener {
                    playing = false
                    position = 0
                    progress = 0f
                }
                mediaPlayer.setOnErrorListener { failed, _, _ ->
                    failed.release()
                    player = null
                    playing = false
                    loading = false
                    snackbar.showError("Не удалось воспроизвести голосовое сообщение")
                    true
                }
                mediaPlayer.prepareAsync()
            } catch (error: Exception) {
                loading = false
                snackbar.showError(error.toAurogramMessage())
            }
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth().background(colors.surfaceRaised, AurogramShapes.Control).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BasicText(
            text = when { loading -> "…"; playing -> "Ⅱ"; else -> "▶" },
            modifier = Modifier.size(36.dp).background(colors.accent, CircleShape).clickable(onClick = ::toggle).padding(start = 11.dp, top = 8.dp),
            style = AurogramTypography.Label.copy(color = colors.surface),
        )
        Canvas(modifier = Modifier.weight(1f).size(width = 1.dp, height = 30.dp)) {
            val heights = message.waveformData?.take(36)?.map { it.coerceIn(5, 100) } ?: List(24) { 25 + (it * 31 % 65) }
            val gap = size.width / (heights.size * 2f)
            heights.forEachIndexed { index, height ->
                val x = gap + index * gap * 2
                val h = size.height * (height / 100f)
                drawLine(
                    color = if (index.toFloat() / heights.size <= progress) colors.accent else colors.border,
                    start = androidx.compose.ui.geometry.Offset(x, (size.height - h) / 2),
                    end = androidx.compose.ui.geometry.Offset(x, (size.height + h) / 2),
                    strokeWidth = 2.dp.toPx(),
                    cap = StrokeCap.Round,
                )
            }
        }
        BasicText("${position / 60}:${(position % 60).toString().padStart(2, '0')}", style = AurogramTypography.Mono.copy(color = colors.muted))
    }
}