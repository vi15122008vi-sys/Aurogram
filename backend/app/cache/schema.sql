CREATE TABLE IF NOT EXISTS cached_accounts (
    account_id TEXT PRIMARY KEY,
    phone TEXT,
    name TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_chats (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('user', 'group', 'channel', 'bot')),
    title TEXT,
    username TEXT,
    last_message_date TEXT,
    last_message_id INTEGER,
    unread INTEGER DEFAULT 0,
    members_count INTEGER,
    meta_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cached_messages (
    chat_id INTEGER NOT NULL,
    id INTEGER NOT NULL,
    sender_id INTEGER,
    text TEXT,
    date TEXT,
    out INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    media_type TEXT,
    waveform_data TEXT,
    last_access TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    raw_json TEXT,
    PRIMARY KEY (chat_id, id)
);

CREATE TABLE IF NOT EXISTS cached_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    mime TEXT,
    size_bytes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_access TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

CREATE TABLE IF NOT EXISTS cached_members (
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT,
    username TEXT,
    tag TEXT,
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS cached_sources (
    chat_id INTEGER PRIMARY KEY,
    offset_date TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_date ON cached_messages(date);
CREATE INDEX IF NOT EXISTS idx_media_message ON cached_media(chat_id, message_id);
CREATE INDEX IF NOT EXISTS idx_chats_last ON cached_chats(last_message_date);
