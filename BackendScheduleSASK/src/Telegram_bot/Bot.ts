import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config(); // Загрузка переменных среды (.env)

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token) throw new Error('Token not found in environment variables');

const bot = new TelegramBot(token, { polling: true });

export default bot;