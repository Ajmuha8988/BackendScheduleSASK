import * as sql from 'mssql';
import sqlConfig from '../config/config';
import bot from '../../Telegram_bot/Bot'

interface TScheduleRequestBody {
    NameGroup: string;
    ID_Lesson: bigint;
    ID_Room: bigint;
    ID_user: bigint;
    NumberLesson: number;
    TimeDate: string;
}
export default async function addTSchedules(req: any, res: any): Promise<void> {
    try {
        const body: TScheduleRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const parts = body.TimeDate.split('/');
        const convertedStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const myDate = new Date(convertedStr);
        const checkData = `SELECT ID_TSchedule FROM TSchedule
        WHERE ID_user = (Select ID_TrueUser
         From TempIDUser
         Where Temp_ID_User = @id_Teachers)
         AND NumberLessons = @numberlessons
		 AND TimeDate = @timedate`;
        const resultCheck = await pool.request()
            .input('id_Teachers', sql.NVarChar, body.ID_user)
            .input('numberlessons', sql.Int, body.NumberLesson)
            .input('timedate', sql.Date, myDate)
            .query(checkData);
        if (resultCheck.recordset.length > 0) {
            res.status(409).json({
                message: 'У преподавателя уже назначена замена на это время'
            });
        } else {
            const check = `SELECT ID_TSchedule FROM TSchedule
            WHERE ID_Group = (Select ID_Group 
	                 From Groups
	                 Where NameGroup = @namegroup)
            AND NumberLessons = @numberlessons
		    AND TimeDate = @timedate`;
            const resultSecondCheck = await pool.request()
                .input('namegroup', sql.NVarChar, body.NameGroup)
                .input('numberlessons', sql.Int, body.NumberLesson)
                .input('timedate', sql.Date, myDate)
                .query(check);
            if (resultSecondCheck.recordset.length > 0) {
                const DataTSchedule = resultCheck.recordset[0]['ID_TSchedule']
                const updateQuery = `UPDATE TSchedule
                SET ID_Group = (Select ID_Group 
	                 From Groups
	                 Where NameGroup = @namegroup),
                ID_Lesson = @lesson, ID_Room = @room,
                ID_user = (Select ID_TrueUser  From TempIDUser Where Temp_ID_User = @id_Teachers), NumberLessons = @numberlessons,
                TimeDate = @timedate
                WHERE ID_TSchedule = @tschedule`;
                const result = await pool.request()
                    .input('namegroup', sql.NVarChar, body.NameGroup)
                    .input('lesson', sql.BigInt, body.ID_Lesson)
                    .input('room', sql.BigInt, body.ID_Room)
                    .input('id_Teachers', sql.BigInt, body.ID_user)
                    .input('numberlessons', sql.Int, body.NumberLesson)
                    .input('timedate', sql.Date, myDate)
                    .input('tschedule', sql.BigInt, DataTSchedule)
                    .query(updateQuery);
                const channelId = '-1002729346237';
                bot.sendMessage(channelId, `<b>Внимание!</b>\nОпубликована замена для группы ${body.NameGroup}.\n<b>Просьба ознакомиться:</b>\nСайт: https://ajmuha8988-schedulesask-3643.twc1.net\nАвторизация также возможна у бота @schedulesask_bot.`,
                    { parse_mode: 'HTML' })
                    .catch(err => console.error('Ошибка при публикации:', err));
               res.status(201).json({
                    message: 'Замена переиздана!'
                });
            } else {
                console.log(body.ID_user);
                const insertQuery = `
               INSERT INTO TSchedule (ID_Group, ID_Lesson, ID_Room, ID_user, NumberLessons, TimeDate)
               VALUES ((Select ID_Group From Groups Where NameGroup = @namegroup), @lesson,  @room,
		       (Select ID_TrueUser  From TempIDUser Where Temp_ID_User = @id_Teachers), @numberlessons, @timedate);`;
                const result = await pool.request().input('dateSecondSemester', sql.Date, myDate)
                    .input('namegroup', sql.NVarChar, body.NameGroup)
                    .input('lesson', sql.BigInt, body.ID_Lesson)
                    .input('room', sql.BigInt, body.ID_Room)
                    .input('id_Teachers', sql.BigInt, body.ID_user)
                    .input('numberlessons', sql.Int, body.NumberLesson)
                    .input('timedate', sql.Date, myDate)
                    .query(insertQuery);
                const channelId = '-1002729346237';
                bot.sendMessage(channelId, `<b>Внимание!</b>\nОпубликована замена для группы ${body.NameGroup}.\n<b>Просьба ознакомиться:</b>\nСайт: https://ajmuha8988-schedulesask-3643.twc1.net\nАвторизация также возможна у бота @schedulesask_bot.`,
                    { parse_mode: 'HTML' })
                    .catch(err => console.error('Ошибка при публикации:', err));
                res.status(201).json({
                    message: 'Замена назначена!'
                });
            }
        }
    } catch (error) {
        console.error('Error during adding:', error);
        res.status(500).json({ message: 'Ошибка при процессе редактирование замен.' });
    }
}