import * as sql from 'mssql';
import sqlConfig from '../config/config';
import generateRandomSequence from '../utils/Randomizer'
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

interface JwtPayload {
    id: string | number; // Идентификатор пользователя (может быть строковым или числовым)
    iat: number;        // Время выдачи токена (issued at time)
    exp: number;        // Срок действия токена (expiration time)
}

export default async function logOut(req: any, res: any): Promise<void> {
    try {
        const tempIdUser = generateRandomSequence();
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as JwtPayload;
        const pool = await sql.connect(sqlConfig);
        const updateQuery = `UPDATE TempIDUser
        SET Temp_ID_User = @newValue
        WHERE ID_TrueUser = @idUser `;
        const updatedResult = await pool.request()
            .input('newValue', sql.BigInt, tempIdUser)
            .input('idUser', sql.BigInt, decodedToken.id)
            .query(updateQuery);
            res.clearCookie('jwt', {
                path: '/',           // Совпадает с предыдущими настройками
                secure: true,        // Опять используем secure
                httpOnly: true,      // Сохраняем HTTP Only
                sameSite: 'none', 
            }); // Имя вашего кукина параметра
            res.clearCookie('jwtpuorg', {
                path: '/',           // Совпадает с предыдущими настройками
                secure: true,        // Опять используем secure
                httpOnly: true,      // Сохраняем HTTP Only
                sameSite: 'none', 
            }); // Имя вашего кукина параметра
            res.json({ success: true });

    } catch (error) {
        console.error('Error in server:', error);
        res.status(500).json({ message: 'Ошибка в сервере.' });
    }
}