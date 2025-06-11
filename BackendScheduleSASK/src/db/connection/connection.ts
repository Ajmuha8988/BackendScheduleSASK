import * as sql from 'mssql';
import sqlConfig from '../config/config';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.FD_STRING) throw new Error('FD_STRING отсутствует!');

const allowedOrigins = process.env.FD_STRING.split(',').filter(Boolean);
const app = express();
const corsOptions = {
    origin: allowedOrigins.map((o) => o.trim())
};
app.use(cors(corsOptions));
app.options('*', cors());
app.use(express.json());

export async function connectToDatabase(): Promise<void> {
    try {
        await sql.connect(sqlConfig);
        console.log('Подключено к базе данных.');
        const pool = await sql.connect(sqlConfig);
        const checkAdministrator = `SELECT COUNT(*) AS count FROM Users 
                                    WHERE Email = @email
                                    AND CallNumber = @callNumber;`;
        const checkAdministratorResult = await pool.request()
            .input('email', sql.NVarChar, process.env.SAE)
            .input('callNumber', sql.NVarChar, process.env.SAC)
            .query(checkAdministrator);
        if (checkAdministratorResult.recordset[0].count > 0) {
            console.log('Администратор готов к работе!');
            return;
        }
        else {
            const result = `
            INSERT INTO Users (Lastname, Firstname, Patronymic, Email, Password, CallNumber, Role)
            VALUES (@lastname, @firstname, @patronymic, @email, @password, @callNumber, @role);`;
            await pool.request()
                .input('lastname', sql.NVarChar, process.env.SAL)
                .input('firstname', sql.NVarChar, process.env.SAF)
                .input('patronymic', sql.NVarChar, process.env.SAP)
                .input('email', sql.NVarChar, process.env.SAE)
                .input('password', sql.NVarChar, process.env.SAPP)
                .input('callNumber', sql.NVarChar, process.env.SAC)
                .input('role', sql.NVarChar, process.env.SAR)
                .query(result);
                console.log(result); // Можно удалить, если не нужен вывод результата вставки
        }
    } catch (error) {
        console.error('Ошибка при подключении:', error);
    }
}
