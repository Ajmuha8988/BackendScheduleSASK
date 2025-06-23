import * as sql from 'mssql';
import sqlConfig from '../../../db/config/config';
import { calculateSemester } from '../../utils/CalculateSemester';
import determineWeekType from '../../utils/CalculateDivined';
import getAcademicWeek from '../../utils/CalculateFirstSemester';
import ToDay from '../../utils/CalculateToDay';

export default async function AuthorizationUser(email: string, password: string) {
    const { semester, dataSemester } = calculateSemester();
    const pool = await sql.connect(sqlConfig);
    const validationQuery = `
        SELECT ID_user, Role, Firstname, Patronymic 
        FROM Users 
        WHERE Email = @email AND Password = @password;
    `;
    const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .input('password', sql.NVarChar, password)
        .query(validationQuery);
    if (result.recordset.length > 0) {
        const checkDateSecondSemester = `
        SELECT ID_DateSecondSemester, DateSecondSemester
        FROM ValueSecondSemester
        WHERE ID_DateSecondSemester = 1;
        `;
        const resultcheckDateSecondSemester = await pool.request().query(checkDateSecondSemester)
        if (result.recordset[0]['Role'] === 'Администратор') {
            return 'Вы являетесь администратором в этой системе и поэтому вам не нужно авторизовываться!';
        }
        else if (result.recordset[0]['Role'] === 'Преподаватель') {
            if (semester === '2-ой семестр') {
                if (resultcheckDateSecondSemester.recordset.length > 0) {
                    const currentDate = resultcheckDateSecondSemester.recordset[0]['DateSecondSemester']
                    const today = new Date();
                    const secondSemesterStart = new Date(currentDate);
                    const kindOfSchedules = determineWeekType(secondSemesterStart, today);
                    if (secondSemesterStart > today) {
                        return "Ошибка в сервере. Пожалуйста, обратитесь к администратору сайта https://ajmuha8988-schedulesask-3643.twc1.net";
                    } else {
                        if (kindOfSchedules === 'Знаменатель') {
                            const UserID = result.recordset[0]['ID_user']
                            const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where Temp_ID_User = (Select Temp_ID_User
							From TempIDUser
							Where ID_TrueUser = @user) AND 
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE Temp_ID_User = (SELECT Temp_ID_User
                                                 FROM TempIDUser
                                                 WHERE ID_TrueUser = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                                const resultTScheduleSASK = await pool.request()
                                .input('user', sql.BigInt, UserID)
                                .query(TScheduleSASK);
                                console.log(resultTScheduleSASK.recordset)
                                const textParts = [
                                    `${kindOfSchedules}`,
                                    '*Понедельник:*',
                                    `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                     '*Вторник:*',
                                    `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    '*Среда:*',
                                    `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    '*Четверг:*',
                                    `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    '*Пятница:*',
                                    `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                    `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                    resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                                        ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                ];
                                return textParts.join('\n');
                        } else if (kindOfSchedules === 'Числитель') {
                            const UserID = result.recordset[0]['ID_user']
                            const PScheduleSASK = `With PSchedulePartNumerator as (
	                            Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                        NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                        Temp_ID_User, KindOfSemester
	                            From PSchedule
	                            Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                        Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                        Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                        Inner Join Users On Users.ID_user = PSchedule.ID_user
		                        Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                                )
		                        Select *
		                        From PSchedulePartNumerator
							    Where Temp_ID_User = (Select Temp_ID_User
							    From TempIDUser
							    Where ID_TrueUser = @user) AND 
							    KindOfSchedules = @kindofschedules AND
                                KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE Temp_ID_User = (SELECT Temp_ID_User
                                                 FROM TempIDUser
                                                 WHERE ID_TrueUser = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                            const resultTScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .query(TScheduleSASK);
                            const textParts = [
                                `${kindOfSchedules}`,
                                '*Понедельник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Вторник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Среда:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Четверг:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Пятница:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,];
                                return textParts.join('\n');
                        } else {
                            return 'Сейчас каникулы'
                        }
                    }
                }
                else {
                    return 'Администратор системы не назначил дату выхода на 2-ом семестре. Пожалуста, обратитесь к нему';
                }
            } else if (semester === '1-ый семестр') {
                const today = new Date();
                const kindOfSchedules = getAcademicWeek(today)
                if (kindOfSchedules === 'Знаменатель') {
                    const UserID = result.recordset[0]['ID_user']
                    const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where Temp_ID_User = (Select Temp_ID_User
							From TempIDUser
							Where ID_TrueUser = @user) AND 
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE Temp_ID_User = (SELECT Temp_ID_User
                                                 FROM TempIDUser
                                                 WHERE ID_TrueUser = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                    const resultTScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .query(TScheduleSASK);
                    const textParts = [
                        `${kindOfSchedules}`,
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:* ',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,];
                    return textParts.join('\n');
                } else if (kindOfSchedules === 'Числитель') {
                    const UserID = result.recordset[0]['ID_user']
                    const PScheduleSASK = `With PSchedulePartNumerator as (
	                            Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                        NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                        Temp_ID_User, KindOfSemester
	                            From PSchedule
	                            Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                        Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                        Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                        Inner Join Users On Users.ID_user = PSchedule.ID_user
		                        Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                                )
		                        Select *
		                        From PSchedulePartNumerator
							    Where Temp_ID_User = (Select Temp_ID_User
							    From TempIDUser
							    Where ID_TrueUser = @user) AND 
							    KindOfSchedules = @kindofschedules AND
                                KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE Temp_ID_User = (SELECT Temp_ID_User
                                                 FROM TempIDUser
                                                 WHERE ID_TrueUser = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                    const resultTScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .query(TScheduleSASK);
                    const textParts = [
                        `${kindOfSchedules}`,
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:* ',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Группа:\t${y.NameGroup ? y.NameGroup : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,];
                    return textParts.join('\n');
                } else {
                    return 'Сейчас каникулы'
                }
            }
        }
        else {
            if (semester === '2-ой семестр') {
                if (resultcheckDateSecondSemester.recordset.length > 0) {
                    const currentDate = resultcheckDateSecondSemester.recordset[0]['DateSecondSemester']
                    const today = new Date();
                    const secondSemesterStart = new Date(currentDate);
                    const kindOfSchedules = determineWeekType(secondSemesterStart, today);
                    if (secondSemesterStart > today) {
                        return "Ошибка в сервере. Пожалуйста, обратитесь к администратору сайта https://ajmuha8988-schedulesask-3643.twc1.net";
                    } else {
                        if (kindOfSchedules === 'Знаменатель') {
                            const UserID = result.recordset[0]['ID_user']
                            const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where ID_Group = (Select ID_Groups
							From Member_groups
							Where ID_Students = @user) AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE ID_Group = (SELECT ID_Groups
                                                 FROM Member_groups
                                                 WHERE ID_Students = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                            const resultTScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .query(TScheduleSASK);
                            console.log(resultTScheduleSASK.recordset)
                            const textParts = [
                                `${kindOfSchedules}`,
                                '*Понедельник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Вторник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Среда:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Четверг:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Пятница:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                ];
                                return textParts.join('\n');
                        } else if (kindOfSchedules === 'Числитель') {
                            const UserID = result.recordset[0]['ID_user']
                            const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where ID_Group = (Select ID_Groups
							From Member_groups
							Where ID_Students = @user) AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE ID_Group = (SELECT ID_Groups
                                                 FROM Member_groups
                                                 WHERE ID_Students = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                            const resultTScheduleSASK = await pool.request()
                                .input('user', sql.NVarChar, UserID)
                                .query(TScheduleSASK);
                            const textParts = [
                                `${kindOfSchedules}`,
                                '*Понедельник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Вторник:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Среда:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Четверг:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Пятница:*',
                                `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                                resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                            ];
                            return textParts.join('\n');
                        } else {
                            return 'Сейчас каникулы'
                        }
                    }
                }
                else {
                    return 'Администратор системы не назначил дату выхода на 2-ом семестре. Пожалуста, обратитесь к нему';
                }
            } else if (semester === '1-ый семестр') {
                const today = new Date();
                const kindOfSchedules = getAcademicWeek(today)
                if (kindOfSchedules === 'Знаменатель') {
                    const UserID = result.recordset[0]['ID_user']
                    const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where ID_Group = (Select ID_Groups
							From Member_groups
							Where ID_Students = @user) AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE ID_Group = (SELECT ID_Groups
                                                 FROM Member_groups
                                                 WHERE ID_Students = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                    const resultTScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .query(TScheduleSASK);
                    const textParts = [
                        `${kindOfSchedules}`,
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                    ];
                        return textParts.join('\n');
                } else if (kindOfSchedules === 'Числитель') {
                    const UserID = result.recordset[0]['ID_user']
                    const PScheduleSASK = `With PSchedulePartNumerator as (
	                        Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                    NumberLessons, DaysOfWeek, KindOfSchedules, Groups.ID_Group, ID_PSchedule,
		                    Temp_ID_User, KindOfSemester
	                        From PSchedule
	                        Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                    Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                    Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                    Inner Join Users On Users.ID_user = PSchedule.ID_user
		                    Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                            )
		                    Select *
		                    From PSchedulePartNumerator
							Where ID_Group = (Select ID_Groups
							From Member_groups
							Where ID_Students = @user) AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const TScheduleSASK = `SET DATEFIRST 1; -- Устанавливаем понедельник первым днем недели
                            WITH TSchedulePartNumerator AS (
                            SELECT NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
                                   NumberLessons, Groups.ID_Group, TimeDate,
                                   Temp_ID_User
                            FROM TSchedule
                            INNER JOIN Lessons ON Lessons.ID_Lesson = TSchedule.ID_Lesson
                            INNER JOIN Groups ON Groups.ID_Group = TSchedule.ID_Group
                            INNER JOIN Rooms ON Rooms.ID_Room = TSchedule.ID_Room
                            INNER JOIN Users ON Users.ID_user = TSchedule.ID_user
                            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = TSchedule.ID_user
                            ),
                            CurrentWeekDates AS (
								SELECT DATEADD(DAY, -(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekStart,
									   DATEADD(DAY, 8-(DATEPART(WEEKDAY, GETDATE()) + @@DATEFIRST - 2), CAST(GETDATE() AS date)) AS WeekEnd
							)
                            SELECT *
                            FROM TSchedulePartNumerator
                            WHERE ID_Group = (SELECT ID_Groups
                                                 FROM Member_groups
                                                 WHERE ID_Students = @user)
                            AND TimeDate >= (SELECT WeekStart FROM CurrentWeekDates)
                            AND TimeDate <= (SELECT WeekEnd FROM CurrentWeekDates);`
                    const resultTScheduleSASK = await pool.request()
                        .input('user', sql.NVarChar, UserID)
                        .query(TScheduleSASK);
                    const textParts = [
                        `${kindOfSchedules}`,
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:*',
                        `*1. 8:00 - 9:30*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultTScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && ToDay(new Date(x.TimeDate)) === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') ||
                        resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                    ];
                    return textParts.join('\n');
                } else {
                    return 'Сейчас каникулы'
                }
            }
        }
    } else {
        return 'В системе нету данного пользователя. Пожалуйста, убедитесь в том, что вы зарегистрированны на сайте https://ajmuha8988-schedulesask-3643.twc1.net';
    }
}