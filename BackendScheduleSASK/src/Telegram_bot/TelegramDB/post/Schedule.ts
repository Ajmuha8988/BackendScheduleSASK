import * as sql from 'mssql';
import sqlConfig from '../../../db/config/config';
import { calculateSemester } from '../../utils/CalculateSemester';
import determineWeekType from '../../utils/CalculateDivined';
import getAcademicWeek from '../../utils/CalculateFirstSemester';

export default async function groupScheduleSASK(group: string) {
    const { semester, dataSemester } = calculateSemester();
    const pool = await sql.connect(sqlConfig);
    const validationQuery = `
        SELECT ID_Group, NameGroup 
        FROM Groups 
        WHERE NameGroup = @namegroup;
    `;
    const result = await pool.request()
        .input('namegroup', sql.NVarChar, group)
        .query(validationQuery);
    console.log('Работает')
    if (result.recordset.length > 0) {
        const checkDateSecondSemester = `
        SELECT ID_DateSecondSemester, DateSecondSemester
        FROM ValueSecondSemester
        WHERE ID_DateSecondSemester = 1;
        `;
        const resultcheckDateSecondSemester = await pool.request().query(checkDateSecondSemester)
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
							Where NameGroup = @namegroup AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('namegroup', sql.NVarChar, group)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const textParts = [
                                '*Понедельник:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Вторник:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''}\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Среда:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Четверг:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Пятница:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                ];
                                return textParts.join('\n');
                        } else if (kindOfSchedules === 'Числитель') {
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
							Where NameGroup = @namegroup AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                            const resultPScheduleSASK = await pool.request()
                                .input('namegroup', sql.NVarChar, group)
                                .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                                .input('kindofsemester', sql.NVarChar, dataSemester)
                                .query(PScheduleSASK);
                            const textParts = [
                                '*Понедельник:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Вторник:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''}\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Среда:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Четверг:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                '*Пятница:*',
                                `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                                    ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                                `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
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
							Where NameGroup = @namegroup AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('namegroup', sql.NVarChar, group)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const textParts = [
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''}\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,

                    ];
                        return textParts.join('\n');
                } else if (kindOfSchedules === 'Числитель') {
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
							Where NameGroup = @namegroup AND
							KindOfSchedules = @kindofschedules AND
                            KindOfSemester = @kindofsemester`
                    const resultPScheduleSASK = await pool.request()
                        .input('namegroup', sql.NVarChar, group)
                        .input('kindofschedules', sql.NVarChar, kindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(PScheduleSASK);
                    const textParts = [
                        '*Понедельник:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Понедельник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Вторник:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''}\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Вторник').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Среда:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Среда').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Четверг:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Четверг').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Пятница:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Пятница').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        '*Суббота:*',
                        `*1. 8:00 - 9:30*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 1 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*2. 9:40 - 11:10*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 2 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*3. 11:30 - 13:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 3 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*4. 13:10 - 14:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 4 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*5. 14:50 - 16:20*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 5 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*6. 16:30 - 18:00*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 6 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,
                        `*7. 18:10 - 19:40*\n${resultPScheduleSASK.recordset.filter((x) => x.NumberLessons === 7 && x.DaysOfWeek === 'Суббота').map
                            ((y) => `Преподаватель:\t${y.Lastname ? y.Lastname : ''} ${y.Firstname ? y.Firstname : ''} ${y.Patronymic ? y.Patronymic : ''},\nУчебный предмет:\t${y.NameLesson ? y.NameLesson : ''},\nКабинет:\t${y.NameRoom ? y.NameRoom : ''}`).join('\n') || 'Занятии нет'}`,

                    ];
                        return textParts.join('\n');
                } else {
                    return 'Сейчас каникулы'
                }
            }
    } else {
        return 'В системе нету данной учебной группы.';
    }
}