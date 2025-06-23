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

export const getTSchedulePart = async (req: Request, res: Response) => {
    try {
        await sql.connect(sqlConfig);
        const decodedToken = jwt.verify(req.cookies.jwtpuorg, process.env.TOKEN_GROUP || '') as IJWTDecoded;
        const request = new sql.Request();
        const result = await request.input('id_nameGroup', sql.NVarChar, decodedToken.id)
            .query(`With TSchedulePart as (
	                    Select NameLesson, NameGroup, NameRoom, Lastname, Firstname, Patronymic,
		                NumberLessons, Groups.ID_Group, ID_TSchedule,
		                Temp_ID_User, TimeDate
	                    From TSchedule
	                    Inner Join Lessons On Lessons.ID_Lesson = TSchedule.ID_Lesson
		                Inner Join Groups On Groups.ID_Group = TSchedule.ID_Group
		                Inner Join Rooms On Rooms.ID_Room = TSchedule.ID_Room
		                Inner Join Users On Users.ID_user = TSchedule.ID_user
		                Inner Join TempIDUser on TempIDUser.ID_TrueUser = TSchedule.ID_user
                        )
		                Select *
		                From TSchedulePart`);
        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных о расписании' });
    }
};