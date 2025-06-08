import * as sql from 'mssql';
import sqlConfig from '../config/config';
import express from 'express';
import cors from 'cors';

const app = express();
const corsOptions = {
    origin: ["http://localhost:49230"]
};
app.use(cors(corsOptions));
app.options('*', cors());
app.use(express.json());

export async function connectToDatabase(): Promise<void> {
    try {
        await sql.connect(sqlConfig);
        console.log('Подключено к базе данных.');

        const checkAdministrator = await sql.query`SELECT COUNT(*) AS count FROM Users 
                                                    WHERE Email = 'KarinaSASK64@mail.ru'
                                                        AND CallNumber = '79284992145';`;

        if (checkAdministrator.recordset[0].count > 0) {
            return;
        }

        const result = await sql.query`
            INSERT INTO Users (Lastname, Firstname, Patronymic, Email, Password, CallNumber, Role)
            VALUES ('Волкова', 'Карина', 'Александровна', 'KarinaSASK64@mail.ru', '111', '79284992145', 'Администратор');`;

        console.log(result); // Можно удалить, если не нужен вывод результата вставки
    } catch (error) {
        console.error('Ошибка при подключении:', error);
    }
}
