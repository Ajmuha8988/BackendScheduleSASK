import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();
interface JwtPayload {
    id: string | number; // Идентификатор пользователя (может быть строковым или числовым)
    iat: number;        // Время выдачи токена (issued at time)
    exp: number;        // Срок действия токена (expiration time)
}

export const getMembers = async (req: Request, res: Response) => {
    try {
        // Подключаемся к базе данных
        await sql.connect(sqlConfig);

        // Проверяем JWT токен пользователя
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as JwtPayload;
        const request = new sql.Request();
        const result = await request.input('userId', sql.BigInt, decodedToken.id)
            .query(`With StudentsInMember as (
	    Select ID_members_group ,ID_Groups ,ID_user, Lastname, Firstname, Patronymic
	    From Users
	    Inner Join Member_groups On Member_groups.ID_Students = Users.ID_user
        ),
        TeachersGroup as (
		Select ID_members_group, Lastname, Firstname, Patronymic
	    From StudentsInMember
	    Inner Join Groups On Groups.ID_Group = StudentsInMember.ID_Groups
		Where ID_Teacher = @userId
		)
		Select *
		From TeachersGroup`);
        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении списка студента в этой группе' });
    }
};