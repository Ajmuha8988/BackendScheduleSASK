import * as sql from 'mssql';
import sqlConfig from '../config/config';
import isDivisible  from '../utils/Divisible';
interface PlanRequestBody {
    ID_Teacher: bigint;
    ID_Lesson: bigint;
    ID_Group: bigint;
    TimeForLesson: number;
    NumberHourInWeek: number;
    KindOfSemester: string;
}

export default async function addPlans(req: any, res: any): Promise<void> {
    try {
        const body: PlanRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        if (body.KindOfSemester === '1-ый') {
            const checkQuery = `With SemesterPlan as (
		    Select ID_Teacher, FirstSemesterHour
		    From TempIDUser
		    Inner Join GeneralBurden on GeneralBurden.ID_Teacher = TempIDUser.ID_TrueUser
		    Where TempIDUser.Temp_ID_User = @id_Teacher
	        )
	        Select ID_Teacher, FirstSemesterHour
	        From SemesterPlan`;

            const checkResult = await pool.request()
                .input('id_Teacher', sql.BigInt, body.ID_Teacher)
                .query(checkQuery);

            if (!checkResult.recordset || !checkResult.recordset.length) {
                res.status(404).json({ error: 'Учитель не найден' });
            }
            else {
                const currentHours = checkResult.recordset[0].FirstSemesterHour;
                if (body.TimeForLesson > currentHours) {
                    // Выдаем ошибку, если часы заканчиваются раньше нуля
                    res.status(404).json({ error: 'Превышено нагрузка на преподавателя!' });
                }
                else {
                    const checkRecord = `
                    Select * From TeacherPlan
                    WHERE ID_Teacher = @id_Teacher and ID_Lesson = @id_Lesson and
                    ID_Group = @id_Group and KindOfSemester = @kindOfSemester`;
                    const ResultRecord = await pool.request()
                        .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                        .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                        .input('id_Group', sql.BigInt, body.ID_Group)
                        .input('kindOfSemester', sql.NVarChar, body.KindOfSemester)
                        .query(checkRecord);
                    if (ResultRecord.recordset.length > 0) {
                        res.status(400).json({ error: 'Такая запись уже существует!' });
                    }
                    else {
                        // Обновляем нагрузку преподавателя
                        const updateQuery = `
                        UPDATE GeneralBurden
                        SET FirstSemesterHour = FirstSemesterHour - @time_for_lesson
                        WHERE ID_Teacher = @id_Teacher`;

                        await pool.request()
                            .input('time_for_lesson', sql.Int, body.TimeForLesson)
                            .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                            .query(updateQuery);

                        // Вставляем новый учебный план
                        const insertQuery = `
                        INSERT INTO TeacherPlan (
                        ID_Teacher, ID_Lesson, ID_Group,
                        TimeForLesson, NumberHourInWeek, KindOfSemester)
                        OUTPUT inserted.ID_TeacherPlan
                        VALUES (
                        @id_Teacher, @id_Lesson, @id_Group,
                        @timeForLesson, @numberHourInWeek, @kindOfSemester);`;

                        const ResultTeacherPlan = await pool.request()
                            .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                            .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                            .input('id_Group', sql.BigInt, body.ID_Group)
                            .input('timeForLesson', sql.Int, body.TimeForLesson)
                            .input('numberHourInWeek', sql.Int, body.NumberHourInWeek)
                            .input('kindOfSemester', sql.NVarChar, body.KindOfSemester)
                            .query(insertQuery);


                        const divisible = isDivisible(body.NumberHourInWeek, 2)
                        if (divisible === true) {
                            const insertQuerySub = `
                            Insert Into SubBurden(ID_TeacherPlan, NumeratorPlan, DenominatorPlan)
                            Values(@idTeacher, @numberHourInWeek / 2, @numberHourInWeek / 2);`;

                            const ResultTeacherSub = await pool.request()
                                .input('idTeacher', sql.BigInt, ResultTeacherPlan.recordset[0].ID_TeacherPlan)
                                .input('numberHourInWeek', sql.Int, body.NumberHourInWeek)
                                .query(insertQuerySub);

                            // Возвращаем успешный статус
                            res.status(201).json({ message: 'Учебный план успешно воссоздан!' });
                        }
                        else {

                            res.status(201).json({ message: 'Учебный план успешно воссоздан!' });
                        }
                    }
                }
            }
            
            
        } else if (body.KindOfSemester === '2-ой') {
            const checkQuery = `
            With SemesterPlan as (
		    Select ID_Teacher, SecondSemesterHour
		    From TempIDUser
		    Inner Join GeneralBurden on GeneralBurden.ID_Teacher = TempIDUser.ID_TrueUser
		    Where TempIDUser.Temp_ID_User = @id_Teacher
	        )
	        Select ID_Teacher, SecondSemesterHour
	        From SemesterPlan`;

            const checkResult = await pool.request()
                .input('id_Teacher', sql.BigInt, body.ID_Teacher)
                .query(checkQuery);

            if (!checkResult.recordset || !checkResult.recordset.length) {
                res.status(404).json({ error: 'Учитель не найден' });
            }
            else {
                const currentHours = checkResult.recordset[0].SecondSemesterHour;
                if (body.TimeForLesson > currentHours) {
                    // Выдаем ошибку, если часы заканчиваются раньше нуля
                    res.status(400).json({ error: 'Превышено нагрузка на преподавателя!' });
                }
                else {
                    const checkRecord = `
                    Select * From TeacherPlan
                    WHERE ID_Teacher = @id_Teacher and ID_Lesson = @id_Lesson and
                    ID_Group = @id_Group and KindOfSemester = @kindOfSemester`;
                    const ResultRecord = await pool.request()
                        .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                        .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                        .input('id_Group', sql.BigInt, body.ID_Group)
                        .input('kindOfSemester', sql.NVarChar, body.KindOfSemester)
                        .query(checkRecord);

                    if (ResultRecord.recordset.length > 0) {
                        res.status(400).json({ error: 'Такая запись уже существует!' });
                    }
                    else {
                        // Обновляем нагрузку преподавателя
                        const updateQuery = `
                        UPDATE GeneralBurden
                        SET SecondSemesterHour = SecondSemesterHour - @time_for_lesson
                        WHERE ID_Teacher = @id_Teacher`;

                        await pool.request()
                            .input('time_for_lesson', sql.Int, body.TimeForLesson)
                            .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                            .query(updateQuery);

                        // Вставляем новый учебный план
                        const insertQuery = `
                        INSERT INTO TeacherPlan (
                        ID_Teacher, ID_Lesson, ID_Group,
                        TimeForLesson, NumberHourInWeek, KindOfSemester)
                        OUTPUT inserted.ID_TeacherPlan
                        VALUES (
                        @id_Teacher, @id_Lesson, @id_Group,
                        @timeForLesson, @numberHourInWeek, @kindOfSemester
                        );`;
                        const ResultTeacherPlan = await pool.request()
                            .input('id_Teacher', sql.BigInt, checkResult.recordset[0].ID_Teacher)
                            .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                            .input('id_Group', sql.BigInt, body.ID_Group)
                            .input('timeForLesson', sql.Int, body.TimeForLesson)
                            .input('numberHourInWeek', sql.Int, body.NumberHourInWeek)
                            .input('kindOfSemester', sql.NVarChar, body.KindOfSemester)
                            .query(insertQuery);

                        const divisible = isDivisible(body.NumberHourInWeek, 2)
                        if (divisible === true) {
                            const insertQuerySub = `
                            Insert Into SubBurden(ID_TeacherPlan, NumeratorPlan, DenominatorPlan)
                            Values(@idTeacher, @numberHourInWeek / 2, @numberHourInWeek / 2);`;

                            const ResultTeacherSub = await pool.request()
                                .input('idTeacher', sql.BigInt, ResultTeacherPlan.recordset[0].ID_TeacherPlan)
                                .input('numberHourInWeek', sql.Int, body.NumberHourInWeek)
                                .query(insertQuerySub);

                            // Возвращаем успешный статус
                            res.status(201).json({ message: 'Учебный план успешно воссоздан!' });
                        }
                        else {

                            res.status(201).json({ message: 'Учебный план успешно воссоздан!' });
                        }
                    }
                }
            }
        } 
    } catch (error) {
        console.error('Error during adding:', error);
        res.status(500).json({ message: 'Ошибка при редактировании учебного плана.' });
    }
}