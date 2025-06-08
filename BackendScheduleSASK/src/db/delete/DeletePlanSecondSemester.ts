import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface PlanRequestBody {
    CallNumbers: string;
    NameLessons: string;
    NameGroups: string;
    TimeForLessons: number;
    NumberHourInWeeks: number;
}

export default async function deletePlanSecondSemester(req: any, res: any): Promise<void> {
    try {
        const body: PlanRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const checkQuery = `With FirstListPlan as (
	    Select TeacherPlan.ID_TeacherPlan, Lastname, Firstname, Patronymic, CallNumber, NameLesson, NameGroup,
		TimeForLesson, NumberHourInWeek, KindOfSemester
	    From TeacherPlan
	    Inner Join Lessons On Lessons.ID_Lesson = TeacherPlan.ID_Lesson
		Inner Join Groups On Groups.ID_Group = TeacherPlan.ID_Group
		Inner Join Users On Users.ID_user = TeacherPlan.ID_Teacher
        )
		Select ID_TeacherPlan From TeacherPlan
		WHERE ID_TeacherPlan = (
		Select ID_TeacherPlan
		From FirstListPlan
		Where CallNumber = @callnumber and
        NameLesson = @namelesson and NameGroup = @namegroups and
		TimeForLesson = @timeforlessons and
        NumberHourInWeek = @numberhourinweeks and KindOfSemester = '2-ой'
		)`;
        const checkResult = await pool.request()
            .input('callnumber', sql.NVarChar, body.CallNumbers)
            .input('namelesson', sql.NVarChar, body.NameLessons)
            .input('namegroups', sql.NVarChar, body.NameGroups)
            .input('timeforlessons', sql.Int, body.TimeForLessons)
            .input('numberhourinweeks', sql.Int, body.NumberHourInWeeks)
            .query(checkQuery);
        const deleteQuery = `
		DELETE SubBurden
		WHERE ID_TeacherPlan = @teacherPlanId;
        DELETE TeacherPlan
		WHERE ID_TeacherPlan = @teacherPlanId;`;
        const deleteResult = await pool.request()
            .input('teacherPlanId', sql.BigInt, checkResult.recordset[0]['ID_TeacherPlan'])
            .query(deleteQuery);
        const updateQuery = `UPDATE GeneralBurden
        SET SecondSemesterHour = SecondSemesterHour + @time_for_lesson
        WHERE ID_Teacher = 
	    (
			Select ID_user
			from Users
			Where CallNumber = @callnumber
	    )`;
        const updatedResult = await pool.request()
            .input('time_for_lesson', sql.Int, body.TimeForLessons)
            .input('callnumber', sql.NVarChar, body.CallNumbers)
            .query(updateQuery);
        res.status(201).json({
            message: 'Запись успешно был удален из учебного плана!',
        });

    } catch (error) {
        console.error('Error during deleting:', error);
        res.status(500).json({ message: 'Ошибка при удаление записи из учебного плана.' });
    }
}