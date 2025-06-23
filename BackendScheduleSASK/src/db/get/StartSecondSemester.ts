import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as dotenv from 'dotenv';

dotenv.config();

export const StartSecondSemester = async (req: Request, res: Response) => {
    try {
        // Подключаемся к базе данных
        await sql.connect(sqlConfig);
        const request = new sql.Request();
        const result = await request.query(`SELECT DateSecondSemester FROM ValueSecondSemester
            WHERE ID_DateSecondSemester = 1`);

        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении преподавателя' });
    }
};