import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getPlan = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`With ListPlan as (
	    Select Lastname, Firstname, Patronymic, NameLesson, NameGroup,
		CallNumber ,TimeForLesson, NumberHourInWeek, KindOfSemester
	    From TeacherPlan
	    Inner Join Lessons On Lessons.ID_Lesson = TeacherPlan.ID_Lesson
		Inner Join Groups On Groups.ID_Group = TeacherPlan.ID_Group
		Inner Join Users On Users.ID_user = TeacherPlan.ID_Teacher
        )
		Select *
		From ListPlan`;

        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};