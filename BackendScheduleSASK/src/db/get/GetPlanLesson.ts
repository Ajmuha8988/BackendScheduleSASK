import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';

export const getPlanLesson = async (req: Request, res: Response) => {
    try {
        // Подключение к базе данных
        await sql.connect(sqlConfig);

        // Выполнение запроса к базе данных
        const result = await sql.query`With ListPlanLesson as (
	    Select TeacherPlan.ID_TeacherPlan ,TempIDUser.Temp_ID_User , Groups.ID_Group , Lessons.ID_Lesson,
        Lastname, Firstname, Patronymic, NameLesson, NameGroup,
		NumberHourInWeek, KindOfSemester
	    From TeacherPlan
	    Inner Join Lessons On Lessons.ID_Lesson = TeacherPlan.ID_Lesson
		Inner Join Groups On Groups.ID_Group = TeacherPlan.ID_Group
		Inner Join Users On Users.ID_user = TeacherPlan.ID_Teacher
		Inner Join TempIDUser On TempIDUser.ID_TrueUser = TeacherPlan.ID_Teacher
        )
		Select *
		From ListPlanLesson`;

        // Отправка результата клиенту
        res.send(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных.' });
    }
};