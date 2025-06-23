import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();
interface IJWTDecoded {
    id: string;
    iat: number;
    exp: number;
}

export const getTeacherPSchedulePart = async (req: Request, res: Response) => {
    try {
        await sql.connect(sqlConfig);
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as IJWTDecoded;
        const request = new sql.Request();
        const result = await request.input('id_nameGroup', sql.NVarChar, decodedToken.id)
            .query(`With TeacherPSchedulePart as (
	                    Select NameLesson, NameGroup, NameRoom, Lastname, Firstname,
                        DaysOfWeek, KindOfSchedules, Patronymic, Groups.ID_Group, NumberLessons,
						KindOfSemester, Temp_ID_User
	                    From PSchedule
	                    Inner Join Lessons On Lessons.ID_Lesson = PSchedule.ID_Lesson
		                Inner Join Groups On Groups.ID_Group = PSchedule.ID_Group
		                Inner Join Rooms On Rooms.ID_Room = PSchedule.ID_Room
		                Inner Join Users On Users.ID_user = PSchedule.ID_user
		                Inner Join TempIDUser on TempIDUser.ID_TrueUser = PSchedule.ID_user
                        )
		                Select *
		                From TeacherPSchedulePart
						Where Temp_ID_User = (Select Temp_ID_User
						From TempIDUser
						Where ID_TrueUser = @id_nameGroup)`);
        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных о расписании' });
    }
};