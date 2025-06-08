import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getIDStudent = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`WITH StudentList AS (
        SELECT Temp_ID_User,
           Lastname,
           Firstname,
           Patronymic
        FROM Users 
        INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = Users.ID_user
        LEFT JOIN Member_groups  ON Member_groups.ID_Students = Users.ID_user
        WHERE Member_groups.ID_Students IS NULL and Users.Role = 'Студент' 
        )
        SELECT *
        FROM StudentList;`;

        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};