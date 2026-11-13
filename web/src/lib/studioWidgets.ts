export type WidgetCategory = "games" | "polls" | "tools";

export interface StudioWidget {
  id: string;
  name: string;
  nameEn: string;
  category: WidgetCategory;
  emoji: string;
  hint: string;
  hintEn: string;
}

type Row = [id: string, name: string, nameEn: string, category: WidgetCategory, emoji: string, hint: string, hintEn: string];

/* Каталог HTML-виджетов: мини-игры, опросы и интерактивные блоки,
   которые можно собрать в Студии и отправить в канал. */
const rows: Row[] = [
  // ── Игры ────────────────────────────────────────────────────────────────
  ["minesweeper", "Сапер", "Minesweeper", "games", "💣", "Поле 9×9 с минами и флажками", "9×9 field with mines and flags"],
  ["2048", "2048", "2048", "games", "🔢", "Плитки, которые складываются в 2048", "Merge tiles up to 2048"],
  ["tic-tac-toe", "Крестики-нолики", "Tic-tac-toe", "games", "❌", "Дуэль на поле 3×3", "Duel on a 3×3 board"],
  ["mafia", "Мафия", "Mafia", "games", "🕵️", "Раздача ролей и ночной ход", "Role dealing and night actions"],
  ["chess", "Шахматы", "Chess", "games", "♟️", "Доска с ходами и таймером", "Board with moves and a clock"],
  ["checkers", "Шашки", "Checkers", "games", "⚫", "Классические шашки 8×8", "Classic 8×8 checkers"],
  ["battleship", "Морской бой", "Battleship", "games", "🚢", "Расстановка флота и выстрелы", "Fleet placement and shots"],
  ["snake", "Змейка", "Snake", "games", "🐍", "Аркада на скорость реакции", "Reflex arcade"],
  ["tetris", "Тетрис", "Tetris", "games", "🧱", "Падающие фигуры и линии", "Falling blocks and lines"],
  ["fifteen", "Пятнашки", "Sliding puzzle", "games", "🔀", "Собери числа по порядку", "Order the numbers"],
  ["sudoku", "Судоку", "Sudoku", "games", "🧩", "Сетка 9×9 с подсказками", "9×9 grid with hints"],
  ["hangman", "Виселица", "Hangman", "games", "🪢", "Угадай слово по буквам", "Guess the word letter by letter"],
  ["bulls-cows", "Быки и коровы", "Bulls and cows", "games", "🐄", "Логика на четырёх цифрах", "Four-digit logic game"],
  ["matchsticks", "Спички", "Matchsticks", "games", "🔥", "Головоломки со спичками", "Matchstick puzzles"],
  ["tanks", "Танчики", "Tanks", "games", "🎯", "Дуэль на клетчатом поле", "Duel on a grid field"],
  ["crocodile", "Крокодил", "Charades", "games", "🐊", "Объясни слово без слов", "Explain the word without words"],

  // ── Опросы и викторины ─────────────────────────────────────────────────
  ["quiz", "Викторина", "Quiz", "polls", "❓", "Вопросы с одним верным ответом", "Questions with one right answer"],
  ["yes-no", "Опрос «Да/Нет»", "Yes/No poll", "polls", "✅", "Быстрый бинарный опрос", "Quick binary poll"],
  ["rating", "Рейтинг-опрос", "Rating poll", "polls", "⭐", "Оценка по пяти звёздам", "Five-star rating"],
  ["image-poll", "Опрос с картинками", "Image poll", "polls", "🖼️", "Варианты с превью фото", "Options with photo previews"],
  ["speed-quiz", "Квиз на скорость", "Speed quiz", "polls", "⚡", "Очки за быстрый ответ", "Points for fast answers"],
  ["guess-word", "Угадай слово", "Guess the word", "polls", "🔤", "Подсказки открываются по буквам", "Hints unlock letter by letter"],
  ["millionaire", "Кто хочет стать миллионером", "Millionaire quiz", "polls", "💰", "Лестница вопросов с подсказками", "Question ladder with lifelines"],
  ["bracket", "Турнирная сетка", "Bracket", "polls", "🏆", "Голосование по раундам плей-офф", "Round-by-round playoff vote"],
  ["best-post", "Голосование за лучший пост", "Best post vote", "polls", "🥇", "Сравнение постов по охвату", "Compare posts by reach"],
  ["scale", "Шкала 1–10", "1–10 scale", "polls", "📊", "Оценка одним ползунком", "Single slider rating"],
  ["multi-choice", "Мультивыбор", "Multiple choice", "polls", "☑️", "Несколько вариантов одновременно", "Several options at once"],
  ["anonymous", "Анонимный опрос", "Anonymous poll", "polls", "🕶️", "Без имён и счётчиков участников", "No names or member counters"],
  ["this-or-that", "Что важнее", "This or that", "polls", "⚖️", "Выбор между двумя вариантами", "Pick between two options"],
  ["blitz", "Блиц-опрос", "Blitz poll", "polls", "🎲", "Десять коротких вопросов", "Ten quick questions"],

  // ── Инструменты ────────────────────────────────────────────────────────
  ["subscriber-counter", "Счётчик подписчиков", "Subscriber counter", "tools", "📈", "Живой счётчик роста аудитории", "Live audience growth counter"],
  ["countdown", "Обратный отсчёт", "Countdown", "tools", "⏳", "Таймер до эфира или запуска", "Timer to a stream or launch"],
  ["events", "Календарь событий", "Event calendar", "tools", "📅", "Список ближайших эфиров", "Upcoming streams list"],
  ["quotes", "Генератор цитат", "Quote generator", "tools", "💬", "Цитата с автором и фоном", "Quote with author and backdrop"],
  ["share", "Кнопка «Поделиться»", "Share button", "tools", "🔗", "Карточка со ссылкой на канал", "Card with a channel link"],
  ["wheel", "Колесо удачи", "Lucky wheel", "tools", "🎡", "Розыгрыш среди подписчиков", "Prize draw for subscribers"],
  ["random-pick", "Случайный выбор", "Random pick", "tools", "🎰", "Выбор победителя из списка", "Pick a random winner"],
  ["calculator", "Калькулятор поста", "Post calculator", "tools", "🧮", "Цена поста по охвату", "Post price by reach"],
  ["checklist", "Чек-лист", "Checklist", "tools", "🗒️", "Список подготовки к публикации", "Pre-publish checklist"],
  ["top-commenters", "Рейтинг комментаторов", "Top commenters", "tools", "🏅", "Топ активных участников", "Most active commenters"],
  ["map", "Интерактивная карта", "Interactive map", "tools", "🗺️", "География подписчиков", "Subscriber geography"],
  ["banner", "Рекламный баннер", "Ad banner", "tools", "📣", "HTML-баннер со ссылкой", "HTML banner with a link"],
];

export const studioWidgets: StudioWidget[] = rows.map(([id, name, nameEn, category, emoji, hint, hintEn]) => ({
  id,
  name,
  nameEn,
  category,
  emoji,
  hint,
  hintEn,
}));

export const widgetCategories: { id: WidgetCategory | "all"; label: string; labelEn: string }[] = [
  { id: "all", label: "Все", labelEn: "All" },
  { id: "games", label: "Игры", labelEn: "Games" },
  { id: "polls", label: "Опросы", labelEn: "Polls" },
  { id: "tools", label: "Инструменты", labelEn: "Tools" },
];

/* Палитра для настройки виджета — значения взяты из текущей темы. */
export const widgetAccents: { id: string; value: string }[] = [
  { id: "accent", value: "var(--accent)" },
  { id: "success", value: "var(--success)" },
  { id: "warning", value: "var(--warning)" },
  { id: "danger", value: "var(--danger)" },
  { id: "ghost", value: "var(--ghost)" },
  { id: "ink", value: "var(--ink)" },
];

/** HTML-сниппет виджета: то, что можно вставить в канал или на сайт. */
export function widgetSnippet(widget: StudioWidget, title: string, text: string, accent: string): string {
  return [
    `<div class="aurogram-widget" data-widget="${widget.id}" style="max-width:520px;padding:18px;border-radius:24px;background:rgba(255,255,255,0.06);backdrop-filter:blur(24px) saturate(180%)">`,
    `  <div style="font-size:28px;line-height:1">${widget.emoji}</div>`,
    `  <h3 style="margin:10px 0 6px;font:600 18px/1.3 system-ui;color:${accent}">${escapeHtml(title)}</h3>`,
    `  <p style="margin:0 0 14px;font:400 14px/1.5 system-ui;color:rgba(255,255,255,0.72)">${escapeHtml(text)}</p>`,
    `  <button style="border:0;border-radius:999px;padding:10px 18px;background:${accent};color:#fff;font:600 13px system-ui;cursor:pointer">${escapeHtml(widget.name)}</button>`,
    `</div>`,
  ].join("\n");
}

/** Текст поста для канала (parse_mode=html). */
export function widgetPost(widget: StudioWidget, title: string, text: string): string {
  return [`<b>${escapeHtml(title)}</b>`, "", escapeHtml(text), "", `${widget.emoji} <i>${escapeHtml(widget.name)}</i>`].join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
