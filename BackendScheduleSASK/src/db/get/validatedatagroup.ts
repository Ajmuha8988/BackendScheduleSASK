import { Request, Response } from 'express';
import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
    id: string | number; // Идентификатор пользователя (может быть строковым или числовым)
    iat: number;        // Время выдачи токена (issued at time)
    exp: number;        // Срок действия токена (expiration time)
}

export default async function ValidateDataGroup(req: Request, res: Response): Promise<void> {
    try {
        await sql.connect(sqlConfig);

        // Проверяем JWT токен пользователя
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as JwtPayload;
        const request = new sql.Request();
        const result = await request.input('userId', sql.BigInt, decodedToken.id)
            .query(`SELECT ID_Group ,NameGroup FROM Groups WHERE ID_Teacher = @userId`);
        res.send(result.recordset);
    } catch (error) {
        res.status(500).json({ message: 'У вас нету группы.' });
    }
}