package com.aurogram.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aurogram.app.data.remote.AurogramApi
import com.aurogram.app.data.remote.ChatDto
import com.aurogram.app.data.remote.RetrofitProvider
import com.aurogram.app.ui.components.AurogramSnackbarState
import com.aurogram.app.ui.components.SnackbarHost
import com.aurogram.app.ui.components.toAurogramMessage
import com.aurogram.app.ui.theme.AurogramShapes
import com.aurogram.app.ui.theme.AurogramTypography
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun ChatsScreen(onOpenChat: (Long, String) -> Unit, api: AurogramApi = RetrofitProvider.api) {
    val colors = LocalAurogramColors.current
    val snackbar = remember { AurogramSnackbarState() }
    var chats by remember { mutableStateOf<List<ChatDto>>(emptyList()) }
    LaunchedEffect(Unit) {
        try {
            chats = api.getChats()
        } catch (error: Exception) {
            snackbar.showError(error.toAurogramMessage())
        }
    }
    Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp)) {
            BasicText("INBOX", style = AurogramTypography.Mono.copy(color = colors.accent))
            Spacer(Modifier.size(6.dp))
            BasicText("Чаты", style = AurogramTypography.Display.copy(color = colors.ink))
            Spacer(Modifier.size(16.dp))
            if (chats.isEmpty()) EmptyState("Чатов пока нет", "Диалоги появятся после синхронизации.")
            else LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(chats, key = { it.id }) { chat ->
                    Column(
                        modifier = Modifier.fillMaxWidth().background(colors.surface, AurogramShapes.Panel).clickable { onOpenChat(chat.id, chat.title) }.padding(14.dp),
                    ) {
                        BasicText(chat.title, style = AurogramTypography.Title.copy(color = colors.ink))
                        Spacer(Modifier.size(4.dp))
                        BasicText(chat.lastMessage ?: chat.type, style = AurogramTypography.Body.copy(color = colors.muted))
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(androidx.compose.ui.Alignment.BottomCenter))
    }
}