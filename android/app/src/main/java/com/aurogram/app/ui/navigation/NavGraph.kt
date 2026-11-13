package com.aurogram.app.ui.navigation

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
//import androidx.compose.foundation.layout.weight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aurogram.app.ui.components.BottomNavBar
import com.aurogram.app.ui.screens.BotDetailScreen
import com.aurogram.app.ui.screens.BotsScreen
import com.aurogram.app.ui.screens.ChannelDetailScreen
import com.aurogram.app.ui.screens.ChannelsScreen
import com.aurogram.app.ui.screens.ChatsScreen
import com.aurogram.app.ui.screens.MessageListScreen
import com.aurogram.app.ui.screens.PostEditorScreen
import com.aurogram.app.ui.screens.SettingsScreen
import com.aurogram.app.ui.screens.StudioScreen
import com.aurogram.app.ui.theme.AurogramThemeId
import com.aurogram.app.ui.theme.LocalAurogramColors

@Composable
fun NavGraph(
    themeId: AurogramThemeId = AurogramThemeId.AurogramDark,
    onThemeChange: (AurogramThemeId) -> Unit = {},
) {
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
                    onOpenStudio = { id, title -> navController.navigate("studio/$id/${Uri.encode(title)}") },
                )
            }
            composable("studio/{channelId}/{title}") { entry ->
                val channelId = entry.arguments?.getString("channelId")?.toLongOrNull() ?: return@composable
                val title = entry.arguments?.getString("title")?.let { Uri.decode(it) }.orEmpty()
                StudioScreen(
                    channelId = channelId,
                    channelTitle = title.ifBlank { "Канал" },
                    onBack = { navController.popBackStack() },
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
            composable("settings") {
                SettingsScreen(themeId = themeId, onThemeChange = onThemeChange)
            }
        }
        BottomNavBar(navController = navController, destination = backStackEntry?.destination)
    }
}
