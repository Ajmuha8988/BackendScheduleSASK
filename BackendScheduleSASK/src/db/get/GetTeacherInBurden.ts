import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getTeacherInBurden = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`With TempInPlan as (
	    Select Temp_ID_User, ID_Teacher, FirstSemesterHour, SecondSemesterHour 
	    From GeneralBurden
	    Inner Join TempIDUser On TempIDUser.ID_TrueUser = GeneralBurden.ID_Teacher
        ), TeacherInPlan as 
		(
			Select Temp_ID_User, Lastname, Firstname, Patronymic, CallNumber,
            FirstSemesterHour, SecondSemesterHour
			From TempInPlan
			Inner Join Users on Users.ID_user = TempInPlan.ID_Teacher
		)
		Select *
		From TeacherInPlan`;
        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};