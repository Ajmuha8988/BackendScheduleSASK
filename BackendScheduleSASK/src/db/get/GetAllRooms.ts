import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getAllrooms = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`Select * From Rooms`;
        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};