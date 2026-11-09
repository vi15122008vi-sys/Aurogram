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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.MessageCreateDto
import com.aurogram.app.data.remote.MessageDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.MessageBubble
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors
import kotlinx.coroutines.launch

@Composable
fun MessageListScreen(
    chatId: Long,
    title: String,
    onBack: () -> Unit,
    api: AurogramApi = RetrofitProvider.api,
) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var messages by remember(chatId) { mutableStateOf<List<MessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var hasMore by remember { mutableStateOf(false) }

    LaunchedEffect(chatId) {
        loading = true
        try {
            val page = api.getMessages(chatId, limit = 50)
            messages = page.reversed()
            hasMore = page.size == 50
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        } finally {
            loading = false
        }
    }

    fun loadOlder() {
        val offset = messages.firstOrNull()?.id ?: return
        if (loading) return
        scope.launch {
            loading = true
            try {
                val page = api.getMessages(chatId, limit = 50, offsetId = offset)
                messages = page.reversed() + messages
                hasMore = page.size == 50
            } catch (error: Exception) {
                snackbar.showError(error.toAurogramMessage())
            } finally {
                loading = false
            }
        }
    }

    fun send() {
        val body = text.trim()
        if (body.isEmpty() || sending) return
        scope.launch {
            sending = true
            try {
                messages = messages + api.sendMessage(MessageCreateDto(chatId = chatId, text = body))
                text = ""
                listState.animateScrollToItem(messages.lastIndex)
            } catch (error: Exception) {
                snackbar.showError(error.toAurogramMessage())
            } finally {
                sending = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp)) {
                BasicText("‹  Чаты", modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp), style = AurogramTypography.Label.copy(color = colors.muted))
                BasicText(title, style = AurogramTypography.Display.copy(color = colors.ink))
            }
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                state = listState,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (hasMore) item(key = "older") {
                    BasicText("Загрузить ещё", modifier = Modifier.fillMaxWidth().clickable(onClick = ::loadOlder).padding(10.dp), style = AurogramTypography.Label.copy(color = colors.accent))
                }
                items(messages, key = { "${it.chatId}:${it.id}" }) { message ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (message.out) Arrangement.End else Arrangement.Start) {
                        MessageBubble(message = message, snackbar = snackbar, api = api)
                    }
                }
                if (!loading && messages.isEmpty()) item { EmptyState("Сообщений нет", "Новые сообщения появятся здесь.") }
            }
            Row(
                modifier = Modifier.fillMaxWidth().background(colors.surface).padding(10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                BasicTextField(
                    value = text,
                    onValueChange = { text = it.take(4096) },
                    modifier = Modifier.weight(1f).background(colors.surfaceRaised, AurogramShapes.Control).padding(horizontal = 12.dp, vertical = 11.dp),
                    textStyle = AurogramTypography.Body.copy(color = colors.ink),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send() }),
                    decorationBox = { inner -> if (text.isBlank()) BasicText("Сообщение…", style = AurogramTypography.Body.copy(color = colors.muted)); inner() },
                )
                BasicText(
                    if (sending) "…" else "Отправить",
                    modifier = Modifier.background(colors.accent, AurogramShapes.Control).clickable(enabled = !sending && text.isNotBlank(), onClick = ::send).padding(horizontal = 12.dp, vertical = 11.dp),
                    style = AurogramTypography.Label.copy(color = colors.surface),
                )
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }
}