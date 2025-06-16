import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import  AuthorizationUser  from './TelegramDB/post/authorization';

// Тип состояния пользователя
type UserState = {
    state?: string; // возможные значения: 'login', 'password'
    login?: string; // временный логин
};

// Хранилище текущих состояний пользователей
const usersStates: Record<string, UserState> = {};

// Запуск Telegram-бота
export function startTelegramBot() {
    dotenv.config(); // загружаем переменные окружения

    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) throw new Error('Telegram bot token is not provided');

    const bot = new TelegramBot(token, { polling: true });

    // Клавиатура с кнопкой перезапуска диалога
    const keyboardButtons: TelegramBot.KeyboardButton[][] = [[{ text: 'Перезапустить диалог' }]];

    const options: TelegramBot.SendMessageOptions = {
        reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };

    // Команда "/start"
    bot.onText(/\/start/i, async (msg) => {
        const chatId = msg.chat.id;
        delete usersStates[chatId];

        await bot.sendMessage(chatId, 'Добро пожаловать в телеграмм бот "Расписание САСК"!', options);
        await bot.sendMessage(chatId, 'Что вам нужно?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Авторизация', callback_data: 'authorization' }],
                    [{ text: 'Расписание занятий', callback_data: 'schedule' }],
                    [{ text: 'Расписание на завтра', callback_data: 'scheduletomorrow' }],
                    [{ text: 'Расписание преподавателя', callback_data: 'scheduleteacher' }]
                ]
            }
        });
    });

    // Кнопка "Перезапустить диалог"
    bot.onText(/^Перезапустить диалог$/i, async (msg) => {
        const chatId = msg.chat.id;
        delete usersStates[chatId];
        await bot.sendMessage(chatId, 'Диалог успешно перезагружен.', options);
        await bot.sendMessage(chatId, 'Что вам нужно?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Авторизация', callback_data: 'authorization' }],
                    [{ text: 'Расписание занятий', callback_data: 'schedule' }],
                    [{ text: 'Расписание на завтра', callback_data: 'scheduletomorrow' }],
                    [{ text: 'Расписание преподавателя', callback_data: 'scheduleteacher' }]
                ]
            }
        });
    });

    // Обработка callback запросов
    bot.on('callback_query', async (query) => {
        const data = query.data;
        let chatId: number | undefined;

        if (query.message && query.message.chat) {
            chatId = query.message.chat.id;
        } else {
            return bot.answerCallbackQuery(query.id, { text: 'Не удалось определить чат.' });
        }

        switch (data) {
            case 'authorization':
                await bot.answerCallbackQuery(query.id);
                usersStates[chatId!] = { state: 'login' }; // устанавливаем режим ожидания логина
                await bot.sendMessage(chatId!, 'Введите вашу почту:');
                break;

            default:
                await bot.answerCallbackQuery(query.id, { text: 'Ошибка обработки.' });
                break;
        }
    });

    // Обработка входящего сообщения
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const messageText = msg.text?.trim();

        if (!usersStates[chatId]) return;

        const state = usersStates[chatId].state;

        switch (state) {
            case 'login':
                usersStates[chatId].state = 'password';
                usersStates[chatId].login = messageText; // запоминаем логин
                await bot.sendMessage(chatId, `Ваша почта: ${messageText}\nТеперь введите пароль.`);
                break;

            case 'password':
                const tempLogin = usersStates[chatId].login; // временно извлекаем логин
                if (!tempLogin || !messageText) {
                    return 'Неправильно введён почта или пароль!';
                }
                delete usersStates[chatId];
                // очищаем состояние пользователя
                const response = await AuthorizationUser(tempLogin, messageText);
                await bot.sendMessage(chatId, response || '', { parse_mode: 'Markdown' });
                break;
        }
    });

    console.log('Бот запущен!');
}