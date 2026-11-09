package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.data.remote.StopWordCreateDto
import com.aurogram.app.data.remote.StopWordDto
import com.aurogram.app.data.remote.StopWordImportDto
import com.aurogram.app.data.remote.StopWordPatchDto
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch

private val wordCategories = listOf(
    "all" to "Все",
    "ads" to "Реклама",
    "profanity" to "Мат",
    "crypto" to "Крипта",
    "casino" to "Казино",
    "bets" to "Ставки",
    "politics" to "Политика",
    "custom" to "Свои",
)

@Composable
fun StopWordsScreen(
    channelId: Long,
    api: AurogramApi = RetrofitProvider.api,
    snackbar: AurogramSnackbarState = remember { AurogramSnackbarState() },
    modifier: Modifier = Modifier,
) {
    val colors = LocalAurogramColors.current
    val scope = rememberCoroutineScope()
    var words by remember(channelId) { mutableStateOf<List<StopWordDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("all") }
    var newWord by remember { mutableStateOf("") }
    var importText by remember { mutableStateOf("") }
    var importFormat by remember { mutableStateOf("txt") }
    var exportText by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    suspend fun reload() {
        words = api.getStopWords(channelId)
    }

    LaunchedEffect(channelId) {
        try {
            reload()
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        }
    }

    val filteredWords = words.filter { word ->
        (category == "all" || word.category == category) && word.word.contains(query, ignoreCase = true)
    }

    LazyColumn(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    decorationBox = { inner -> if (query.isBlank()) BasicText("Поиск стоп-слов", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
                BasicText("${filteredWords.size}", style = AurogramTypography.Mono.copy(color = colors.muted))
            }
        }
        item {
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                wordCategories.forEach { (id, label) ->
                    val active = category == id
                    BasicText(
                        text = label,
                        modifier = Modifier.background(if (active) colors.accent else colors.surface, AurogramShapes.Control).clickable { category = id }.padding(horizontal = 10.dp, vertical = 8.dp),
                        style = AurogramTypography.Label.copy(color = if (active) colors.surface else colors.muted),
                    )
                }
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(12.dp)) {
                BasicTextField(
                    value = newWord,
                    onValueChange = { newWord = it.take(200) },
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    decorationBox = { inner -> if (newWord.isBlank()) BasicText("Новое слово или фраза", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.size(10.dp))
                BasicText(
                    text = if (busy) "Сохраняем…" else "Добавить",
                    modifier = Modifier.background(colors.accent, AurogramShapes.Control).clickable(enabled = !busy && newWord.isNotBlank()) {
                        busy = true
                        scope.launch {
                            try {
                                api.addStopWord(channelId, StopWordCreateDto(newWord.trim(), if (category == "all") "custom" else category, isRegex = false))
                                newWord = ""
                                reload()
                                snackbar.showSuccess("Стоп-слово добавлено")
                            } catch (error: Exception) {
                                snackbar.showError(error.toAurogramMessage())
                            } finally {
                                busy = false
                            }
                        }
                    }.padding(horizontal = 14.dp, vertical = 9.dp),
                    style = AurogramTypography.Label.copy(color = colors.surface),
                )
            }
        }
        items(filteredWords, key = { it.id ?: it.word }) { word ->
            Row(
                modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    BasicText(word.word, style = AurogramTypography.Body.copy(color = if (word.enabled) colors.ink else colors.muted))
                    Spacer(Modifier.size(3.dp))
                    BasicText(wordCategories.firstOrNull { it.first == word.category }?.second ?: word.category, style = AurogramTypography.Mono.copy(color = colors.muted))
                }
                BasicText(
                    text = if (word.enabled) "Вкл" else "Выкл",
                    modifier = Modifier.clickable(enabled = !busy && word.id != null) {
                        scope.launch {
                            try {
                                api.updateStopWord(channelId, word.id!!, StopWordPatchDto(enabled = !word.enabled))
                                reload()
                            } catch (error: Exception) {
                                snackbar.showError(error.toAurogramMessage())
                            }
                        }
                    }.padding(horizontal = 10.dp, vertical = 8.dp),
                    style = AurogramTypography.Label.copy(color = if (word.enabled) colors.accent else colors.muted),
                )
                if (!word.isBuiltin && word.id != null) {
                    BasicText(
                        "Удалить",
                        modifier = Modifier.clickable(enabled = !busy) {
                            scope.launch {
                                try {
                                    api.deleteStopWord(channelId, word.id)
                                    reload()
                                } catch (error: Exception) {
                                    snackbar.showError(error.toAurogramMessage())
                                }
                            }
                        }.padding(start = 8.dp, top = 8.dp, bottom = 8.dp),
                        style = AurogramTypography.Label.copy(color = colors.danger),
                    )
                }
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(12.dp)) {
                BasicText("Импорт / экспорт", style = AurogramTypography.Title.copy(color = colors.ink))
                Spacer(Modifier.size(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("txt", "json").forEach { format ->
                        BasicText(format.uppercase(), modifier = Modifier.background(if (importFormat == format) colors.accent else colors.surfaceRaised, AurogramShapes.Control).clickable { importFormat = format }.padding(horizontal = 10.dp, vertical = 7.dp), style = AurogramTypography.Mono.copy(color = if (importFormat == format) colors.surface else colors.muted))
                    }
                }
                Spacer(Modifier.size(8.dp))
                BasicTextField(
                    value = importText,
                    onValueChange = { importText = it.take(1_000_000) },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = AurogramTypography.Mono.copy(color = colors.ink),
                    decorationBox = { inner -> if (importText.isBlank()) BasicText("Список слов или JSON", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
                Spacer(Modifier.size(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    BasicText("Импорт", modifier = Modifier.clickable(enabled = !busy && importText.isNotBlank()) {
                        scope.launch {
                            busy = true
                            try {
                                val result = api.importStopWords(channelId, StopWordImportDto(importFormat, importText, if (category == "all") "custom" else category))
                                reload()
                                snackbar.showSuccess("Импортировано ${result.imported}, пропущено ${result.skipped}")
                            } catch (error: Exception) {
                                snackbar.showError(error.toAurogramMessage())
                            } finally {
                                busy = false
                            }
                        }
                    }.padding(vertical = 8.dp), style = AurogramTypography.Label.copy(color = colors.accent))
                    BasicText("Экспорт JSON", modifier = Modifier.clickable {
                        scope.launch {
                            try { exportText = api.exportStopWords(channelId, "json").string() }
                            catch (error: Exception) { snackbar.showError(error.toAurogramMessage()) }
                        }
                    }.padding(vertical = 8.dp), style = AurogramTypography.Label.copy(color = colors.muted))
                    BasicText("Экспорт TXT", modifier = Modifier.clickable {
                        scope.launch {
                            try { exportText = api.exportStopWords(channelId, "txt").string() }
                            catch (error: Exception) { snackbar.showError(error.toAurogramMessage()) }
                        }
                    }.padding(vertical = 8.dp), style = AurogramTypography.Label.copy(color = colors.muted))
                }
                if (exportText.isNotBlank()) {
                    Spacer(Modifier.size(8.dp))
                    BasicText(exportText.take(1000), style = AurogramTypography.Mono.copy(color = colors.muted))
                }
            }
        }
    }
}