package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AntispamSettingsDto
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch

@Composable
fun AntispamScreen(
    channelId: Long,
    api: AurogramApi = RetrofitProvider.api,
    snackbar: AurogramSnackbarState = remember { AurogramSnackbarState() },
) {
    val colors = LocalAurogramColors.current
    val scope = rememberCoroutineScope()
    var settings by remember(channelId) { mutableStateOf<AntispamSettingsDto?>(null) }
    var busy by remember { mutableStateOf(false) }
    var showStopWords by remember(channelId) { mutableStateOf(false) }

    LaunchedEffect(channelId) {
        busy = true
        try {
            settings = api.getAntispamSettings(channelId)
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        } finally {
            busy = false
        }
    }

    if (showStopWords) {
        Column(modifier = Modifier.fillMaxSize().background(LocalAurogramColors.current.canvas)) {
            BasicText(
                "‹  Антиспам",
                modifier = Modifier.clickable { showStopWords = false }.padding(horizontal = 16.dp, vertical = 10.dp),
                style = AurogramTypography.Label.copy(color = LocalAurogramColors.current.muted),
            )
            StopWordsScreen(channelId = channelId, api = api, snackbar = snackbar, modifier = Modifier.weight(1f))
        }
        return
    }

    val value = settings
    if (value == null) {
        BasicText("Загружаем настройки…", modifier = Modifier.padding(20.dp), style = AurogramTypography.Body.copy(color = colors.muted))
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            BasicText(
                "Управление стоп-словами  →",
                modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Control).clickable { showStopWords = true }.padding(14.dp),
                style = AurogramTypography.Label.copy(color = colors.accent),
            )
        }
        item {
            SettingToggle("Антиспам", "Модерация linked discussion чата", value.enabled) { settings = value.copy(enabled = it) }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
                BasicText("Уровень защиты", style = AurogramTypography.Label.copy(color = colors.muted))
                Spacer(Modifier.size(8.dp))
                ChoiceRow(listOf("soft" to "Мягкий", "medium" to "Средний", "hard" to "Строгий"), value.level) { settings = value.copy(level = it) }
                Spacer(Modifier.size(14.dp))
                BasicText("Политика ссылок", style = AurogramTypography.Label.copy(color = colors.muted))
                Spacer(Modifier.size(8.dp))
                ChoiceRow(listOf("blacklist_only" to "Blocklist", "allowlist_only" to "Allowlist", "block_all" to "Все"), value.linksPolicy) { settings = value.copy(linksPolicy = it) }
            }
        }
        item { NumberSetting("Порог флуда", value.floodThreshold, 1..100) { settings = value.copy(floodThreshold = it) } }
        item { NumberSetting("Окно флуда, сек", value.floodWindowSec, 1..3600) { settings = value.copy(floodWindowSec = it) } }
        item { NumberSetting("Мин. длина капса", value.capsMinLen, 1..32768) { settings = value.copy(capsMinLen = it) } }
        item { NumberSetting("Порог капса, %", (value.capsRatio * 100).toInt(), 0..100) { settings = value.copy(capsRatio = it / 100f) } }
        item { NumberSetting("Максимум эмодзи", value.emojiMax, 0..1000) { settings = value.copy(emojiMax = it) } }
        item { NumberSetting("Окно дублей, мин", value.duplicateWindowMin, 0..1440) { settings = value.copy(duplicateWindowMin = it) } }
        item { NumberSetting("Длительность мута, мин", value.muteMinutes, 1..10080) { settings = value.copy(muteMinutes = it) } }
        item { TextSetting("Allowlist доменов", value.allowlistCustom.joinToString("\n")) { settings = value.copy(allowlistCustom = it.lines().map(String::trim).filter(String::isNotEmpty)) } }
        item { TextSetting("Отключить глобальные allowlist домены", value.allowlistGlobalDisabled.joinToString("\n")) { settings = value.copy(allowlistGlobalDisabled = it.lines().map(String::trim).filter(String::isNotEmpty)) } }
        item { SettingToggle("Стемминг стоп-слов", "Сопоставлять словоформы", value.stem) { settings = value.copy(stem = it) } }
        item { SettingToggle("Учитывать регистр", "Различать заглавные и строчные", value.caseSensitive) { settings = value.copy(caseSensitive = it) } }
        item { SettingToggle("Точное совпадение", "Не искать слово внутри другого слова", value.exactMatch) { settings = value.copy(exactMatch = it) } }
        item { SettingToggle("Антифлуд", "Проверять временное окно сообщений", value.floodEnabled) { settings = value.copy(floodEnabled = it) } }
        item { SettingToggle("Капс", "Проверять долю заглавных букв", value.capsEnabled) { settings = value.copy(capsEnabled = it) } }
        item { SettingToggle("Эмодзи-спам", "Ограничивать количество эмодзи", value.emojiEnabled) { settings = value.copy(emojiEnabled = it) } }
        item { SettingToggle("Разрешать поддомены", "Применять allowlist к поддоменам", value.allowSubdomains) { settings = value.copy(allowSubdomains = it) } }
        item { SettingToggle("Разрешать IP-ссылки", "Не блокировать голые IP", value.allowRawIp) { settings = value.copy(allowRawIp = it) } }
        item { SettingToggle("Разрешать shortlinks", "Пропускать сокращённые ссылки", value.allowShortlinks) { settings = value.copy(allowShortlinks = it) } }
        item { SettingToggle("Уведомлять автора", "Отправлять личное уведомление", value.notifyAuthorDm) { settings = value.copy(notifyAuthorDm = it) } }
        item { SettingToggle("Мут при повторе", "Применять временное ограничение", value.muteOnRepeat) { settings = value.copy(muteOnRepeat = it) } }
        item { SettingToggle("Бан при третьем нарушении", "Блокировать после повторов", value.banOnThird) { settings = value.copy(banOnThird = it) } }
        item { SettingToggle("Проверять подписи медиа", "Обрабатывать текст caption", value.checkInMediaCaptions) { settings = value.copy(checkInMediaCaptions = it) } }
        item {
            BasicText(
                text = if (busy) "Сохраняем…" else "Сохранить настройки",
                modifier = Modifier.fillMaxWidth().background(colors.accent, AurogramShapes.Control).clickable(enabled = !busy) {
                    busy = true
                    scope.launch {
                        try {
                            settings = api.saveAntispamSettings(channelId, settings ?: value)
                            snackbar.showSuccess("Настройки сохранены")
                        } catch (error: Exception) {
                            snackbar.showError(error.toAurogramMessage())
                        } finally {
                            busy = false
                        }
                    }
                }.padding(14.dp),
                style = AurogramTypography.Label.copy(color = colors.surface),
            )
        }
    }
}

@Composable
private fun SettingToggle(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = LocalAurogramColors.current
    Row(
        modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).clickable { onChange(!checked) }.padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            BasicText(title, style = AurogramTypography.Label.copy(color = colors.ink))
            Spacer(Modifier.size(3.dp))
            BasicText(subtitle, style = AurogramTypography.Body.copy(color = colors.muted))
        }
        BasicText(if (checked) "✓" else "", modifier = Modifier.background(if (checked) colors.accent else colors.surfaceRaised, AurogramShapes.Control).padding(horizontal = 10.dp, vertical = 6.dp), style = AurogramTypography.Label.copy(color = colors.surface))
    }
}

@Composable
private fun ChoiceRow(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val colors = LocalAurogramColors.current
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (value, label) ->
            val active = selected == value
            BasicText(label, modifier = Modifier.weight(1f).background(if (active) colors.accent else colors.surfaceRaised, AurogramShapes.Control).clickable { onSelect(value) }.padding(horizontal = 6.dp, vertical = 9.dp), style = AurogramTypography.Label.copy(color = if (active) colors.surface else colors.muted), maxLines = 1)
        }
    }
}

@Composable
private fun NumberSetting(label: String, value: Int, range: IntRange, onChange: (Int) -> Unit) {
    val colors = LocalAurogramColors.current
    Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
        BasicText(label, style = AurogramTypography.Label.copy(color = colors.muted))
        BasicTextField(
            value = value.toString(),
            onValueChange = { input -> input.toIntOrNull()?.let { onChange(it.coerceIn(range)) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = AurogramTypography.Mono.copy(color = colors.ink),
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
    }
}

@Composable
private fun TextSetting(label: String, value: String, onChange: (String) -> Unit) {
    val colors = LocalAurogramColors.current
    Column(modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).padding(14.dp)) {
        BasicText(label, style = AurogramTypography.Label.copy(color = colors.muted))
        BasicTextField(value = value, onValueChange = onChange, textStyle = AurogramTypography.Body.copy(color = colors.ink), modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
    }
}