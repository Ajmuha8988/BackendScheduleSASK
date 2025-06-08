import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getAllteachers = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`With TeachersList as (
	    Select TempIDUser.Temp_ID_User ,Lastname, Firstname, Patronymic
	    From Users
	    Inner Join TempIDUser on TempIDUser.ID_TrueUser = Users.ID_user 
	    and Users.Role = 'Преподаватель'
	    )
	    Select *
	    From TeachersList`;
        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};