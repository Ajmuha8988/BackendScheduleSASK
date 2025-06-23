import  bot from './Bot'
import * as dotenv from 'dotenv';
import AuthorizationUser from './TelegramDB/post/authorization';
import groupScheduleSASK from './TelegramDB/post/Schedule';
import TomorrowScheduleSASK from './TelegramDB/post/ScheduleTomorrow';
import ScheduleTeacher from './TelegramDB/post/ScheduleTeacher';
import TelegramBot from 'node-telegram-bot-api';
// Тип состояния пользователя
type UserState = {
    state?: string; // возможные значения: 'login', 'password'
    login?: string; // временный логин
    group?: string;
    groupTomorrow?: string;
    firstname?: string; // временный логин
    lastname?: string;
    patronymic?: string;
};

// Хранилище текущих состояний пользователей
const usersStates: Record<string, UserState> = {};

// Запуск Telegram-бота
export function startTelegramBot() {
    dotenv.config(); // загружаем переменные окружения

    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) throw new Error('Телеграмм бот не обнаружен');

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
            case 'schedule':
                await bot.answerCallbackQuery(query.id);
                usersStates[chatId!] = { state: 'group' }; // устанавливаем режим ожидания логина
                await bot.sendMessage(chatId!, 'Введите группу:');
                break;
            case 'scheduletomorrow':
                await bot.answerCallbackQuery(query.id);
                usersStates[chatId!] = { state: 'groupTomorrow' }; // устанавливаем режим ожидания логина
                await bot.sendMessage(chatId!, 'Введите группу:');
                break;
            case 'scheduleteacher':
                await bot.answerCallbackQuery(query.id);
                usersStates[chatId!] = { state: 'lastname' }; // устанавливаем режим ожидания логина
                await bot.sendMessage(chatId!, 'Введите фамилию преподавателя:');
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
            case 'lastname':
                usersStates[chatId].state = 'firstname';
                usersStates[chatId].lastname = messageText; // запоминаем фамилию
                await bot.sendMessage(chatId, `Фамилия преподавателя: ${messageText}\nТеперь введите имя преподавателя:`);
                break;
            case 'firstname':
                const tempLastname = usersStates[chatId].lastname;
                usersStates[chatId].state = 'patronymic';
                usersStates[chatId].firstname = messageText; // запоминаем логин
                await bot.sendMessage(chatId, `Фамилия преподавателя: ${tempLastname}\nИмя преподавателя: ${messageText}\nТеперь введите отчество преподавателя:`);
                break;
            case 'patronymic':
                const tempLastnames = usersStates[chatId].lastname;
                const tempFirstname = usersStates[chatId].firstname;
                if (!tempLastnames || !messageText || !tempFirstname) {
                    return 'Неправильно введены данные !';
                }
                delete usersStates[chatId];
                await bot.sendMessage(chatId, `Фамилия преподавателя: ${tempLastnames}\nИмя преподавателя: ${tempFirstname}\nОтчество: ${messageText}`);
                const responseTeacher = await ScheduleTeacher(tempLastnames, tempFirstname, messageText);
                await bot.sendMessage(chatId, responseTeacher || '', { parse_mode: 'Markdown' });
                break;
            case 'login':
                usersStates[chatId].state = 'password';
                usersStates[chatId].login = messageText; // запоминаем логин
                await bot.sendMessage(chatId, `Ваша почта: ${messageText}\nТеперь введите пароль.`);
                break;
            case 'group':
                if (!messageText) {
                    return 'Неправильно введена группа!';
                }
                const responseGroup = await groupScheduleSASK(messageText);
                await bot.sendMessage(chatId, responseGroup || '', { parse_mode: 'Markdown' });
                break;
            case 'groupTomorrow':
                if (!messageText) {
                    return 'Неправильно введена группа!';
                }
                const responseGroupTommorow = await TomorrowScheduleSASK(messageText);
                await bot.sendMessage(chatId, responseGroupTommorow || '', { parse_mode: 'Markdown' });
                break;
            case 'password':
                const tempLogin = usersStates[chatId].login; // временно извлекаем логин
                if (!tempLogin || !messageText) {
                    return 'Неправильно введена почта или пароль!';
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