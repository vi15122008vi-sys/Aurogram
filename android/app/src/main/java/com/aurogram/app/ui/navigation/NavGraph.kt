package com.aurogram.app.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.weight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import android.net.Uri
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aurogram.app.ui.components.BottomNavBar
import com.aurogram.app.ui.screens.RootScreen
import com.aurogram.app.ui.screens.BotsScreen
import com.aurogram.app.ui.screens.BotDetailScreen
import com.aurogram.app.ui.screens.ChannelDetailScreen
import com.aurogram.app.ui.screens.ChannelsScreen
import com.aurogram.app.ui.screens.ChatsScreen
import com.aurogram.app.ui.screens.MessageListScreen
import com.aurogram.app.ui.screens.PostEditorScreen
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun NavGraph() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val colors = LocalAurogramColors.current

    Column(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
        NavHost(
            navController = navController,
            startDestination = "channels",
            modifier = Modifier.weight(1f),
        ) {
            composable("channels") {
                ChannelsScreen(onOpenChannel = { channelId -> navController.navigate("channel/$channelId") })
            }
            composable("channel/{channelId}") { entry ->
                val channelId = entry.arguments?.getString("channelId")?.toLongOrNull() ?: return@composable
                ChannelDetailScreen(
                    channelId = channelId,
                    onBack = { navController.popBackStack() },
                    onOpenPostEditor = { id -> navController.navigate("post/$id") },
                )
            }
            composable("post/{channelId}") { entry ->
                val channelId = entry.arguments?.getString("channelId")?.toLongOrNull() ?: return@composable
                PostEditorScreen(channelId = channelId, onBack = { navController.popBackStack() })
            }
            composable("bots") {
                BotsScreen(onOpenBot = { botId -> navController.navigate("bot/$botId") })
            }
            composable("bot/{botId}") { entry ->
                val botId = entry.arguments?.getString("botId")?.toLongOrNull() ?: return@composable
                BotDetailScreen(botId = botId, onBack = { navController.popBackStack() }, onRemoved = { navController.popBackStack() })
            }
            composable("chats") {
                ChatsScreen(onOpenChat = { chatId, title -> navController.navigate("messages/$chatId/${Uri.encode(title)}") })
            }
            composable("messages/{chatId}/{title}") { entry ->
                val chatId = entry.arguments?.getString("chatId")?.toLongOrNull() ?: return@composable
                val title = entry.arguments?.getString("title")?.let { Uri.decode(it) }.orEmpty()
                MessageListScreen(chatId = chatId, title = title, onBack = { navController.popBackStack() })
            }
            composable("settings") { RootScreen("Настройки", "PREFERENCES", "Настроек нет") }
        }
        BottomNavBar(navController = navController, destination = backStackEntry?.destination)
    }
}