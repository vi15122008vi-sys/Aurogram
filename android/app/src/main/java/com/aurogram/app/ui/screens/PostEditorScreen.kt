package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.EditorPreviewDto
import com.aurogram.app.data.remote.EditorPreviewRequestDto
import com.aurogram.app.data.remote.PostCreateDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch
import java.time.OffsetDateTime

@Composable
fun PostEditorScreen(
    channelId: Long,
    onBack: () -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    val scope = rememberCoroutineScope()
    var value by remember { mutableStateOf(TextFieldValue()) }
    var schedule by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<EditorPreviewDto?>(null) }
    var loading by remember { mutableStateOf(false) }
    var scheduled by remember { mutableStateOf(false) }

    fun format(prefix: String, suffix: String = prefix) {
        val start = value.selection.min
        val end = value.selection.max
        val selected = value.text.substring(start, end).ifBlank { "текст" }
        val next = value.text.replaceRange(start, end, "$prefix$selected$suffix")
        value = TextFieldValue(next, selection = TextRange(start + prefix.length, start + prefix.length + selected.length))
        preview = null
    }

    fun requestPreview() {
        if (value.text.isBlank()) return
        scope.launch {
            loading = true
            try {
                preview = api.previewPost(EditorPreviewRequestDto(value.text))
                preview?.error?.let(snackbar::showError)
            } catch (error: Exception) {
                snackbar.showError(error.toAurogramMessage())
            } finally {
                loading = false
            }
        }
    }

    fun publish(isScheduled: Boolean) {
        if (value.text.isBlank() || loading) return
        val scheduleIso = if (isScheduled) {
            runCatching { OffsetDateTime.parse(schedule).toString() }.getOrElse {
                snackbar.showError("Укажите дату в формате 2026-11-09T18:30:00+03:00")
                return
            }
        } else null
        scope.launch {
            loading = true
            try {
                api.publishPost(channelId, PostCreateDto(text = value.text, scheduleAt = scheduleIso))
                scheduled = isScheduled
                snackbar.showSuccess(if (isScheduled) "Пост запланирован" else "Пост опубликован")
                value = TextFieldValue()
                schedule = ""
                preview = null
            } catch (error: Exception) {
                snackbar.showError(error.toAurogramMessage())
            } finally {
                loading = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            BasicText("‹  Назад", modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp), style = AurogramTypography.Label.copy(color = colors.muted))
            Spacer(Modifier.size(12.dp))
            BasicText("Новый пост", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.size(4.dp))
            BasicText("Markdown  ·  ${value.text.length} / 32 768", style = AurogramTypography.Mono.copy(color = colors.muted))
            Spacer(Modifier.size(16.dp))
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    BasicText("B", modifier = Modifier.clickable { format("**") }, style = AurogramTypography.Title.copy(color = colors.ink))
                    BasicText("I", modifier = Modifier.clickable { format("_") }, style = AurogramTypography.Title.copy(color = colors.ink))
                    BasicText("Code", modifier = Modifier.clickable { format("`") }, style = AurogramTypography.Mono.copy(color = colors.ink))
                    BasicText("Link", modifier = Modifier.clickable { format("[", "](https://example.com)") }, style = AurogramTypography.Mono.copy(color = colors.ink))
                    Spacer(Modifier.weight(1f))
                    BasicText("Preview", modifier = Modifier.clickable { requestPreview() }, style = AurogramTypography.Label.copy(color = colors.accent))
                }
                Spacer(Modifier.size(14.dp))
                BasicTextField(
                    value = value,
                    onValueChange = { value = it; preview = null },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    minLines = 8,
                    maxLines = 16,
                    decorationBox = { inner -> if (value.text.isBlank()) BasicText("Текст публикации…", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
            }
            if (preview != null) {
                Spacer(Modifier.size(10.dp))
                Column(modifier = Modifier.fillMaxWidth().background(colors.surfaceRaised, AurogramShapes.Control).padding(14.dp)) {
                    BasicText("Предпросмотр", style = AurogramTypography.Label.copy(color = colors.muted))
                    Spacer(Modifier.size(8.dp))
                    BasicText(value.text, style = AurogramTypography.Body.copy(color = colors.ink))
                    preview?.warnings?.forEach { warning ->
                        Spacer(Modifier.size(6.dp))
                        BasicText(warning, style = AurogramTypography.Label.copy(color = colors.warning))
                    }
                }
            }
            Spacer(Modifier.size(12.dp))
            BasicTextField(
                value = schedule,
                onValueChange = { schedule = it },
                modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Control).padding(12.dp),
                textStyle = AurogramTypography.Mono.copy(color = colors.ink),
                decorationBox = { inner -> if (schedule.isBlank()) BasicText("Дата: 2026-11-09T18:30:00+03:00", style = AurogramTypography.Mono.copy(color = colors.muted)); inner() },
            )
            Spacer(Modifier.size(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BasicText(
                    text = if (loading) "Отправляем…" else "Опубликовать",
                    modifier = Modifier.weight(1f).background(colors.accent, AurogramShapes.Control).clickable(enabled = !loading && value.text.isNotBlank()) { publish(false) }.padding(14.dp),
                    style = AurogramTypography.Label.copy(color = colors.surface),
                )
                BasicText(
                    text = if (scheduled) "Запланирован" else "Отложить",
                    modifier = Modifier.weight(1f).background(colors.surface, AurogramShapes.Control).clickable(enabled = !loading && value.text.isNotBlank()) { publish(true) }.padding(14.dp),
                    style = AurogramTypography.Label.copy(color = colors.ink),
                )
            }
        }
        SnackbarHost(snackbar, Modifier.align(androidx.compose.ui.Alignment.BottomCenter))
    }
}