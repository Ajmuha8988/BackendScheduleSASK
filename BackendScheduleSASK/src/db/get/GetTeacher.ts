import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

export const getTeacherID = async (req: Request, res: Response) => {
    try {
        // Подключаемся к базе данных
        await sql.connect(sqlConfig);

        // Проверяем JWT токен пользователя
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '');
        const request = new sql.Request();
        const result = await request.input('userId', sql.BigInt, decodedToken)
            .query(`SELECT Temp_ID_User FROM TempIDUser
            WHERE ID_TrueUser = @userId`);

        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении преподавателя' });
    }
};