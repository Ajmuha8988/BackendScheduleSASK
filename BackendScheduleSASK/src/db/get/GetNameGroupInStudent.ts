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

export const getNameGroupInStudent = async (req: Request, res: Response) => {
    try {
        // Подключаемся к базе данных
        await sql.connect(sqlConfig);
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as IJWTDecoded;
        const request = new sql.Request();
        const result = await request.input('id_Group', sql.NVarChar, decodedToken.id)
        .query(`Select NameGroup From Groups
        Where ID_Group = (Select ID_Groups
		From Member_groups
		Where ID_Students = @id_Group)`);
        res.send(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Ошибка при получении данных о расписании' });
    }
};