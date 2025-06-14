import * as sql from 'mssql';
import sqlConfig from '../config/config';
import jwt from 'jsonwebtoken';
import generateRandomSequence from '../utils/Randomizer'
interface AuthorizationRequestBody {
    Email: string;
    Password: string;
}
interface UserData {
    ID_user: bigint;
    Firstname: string;
    Patronymic: string;
    Role: string;
}

export default async function authorizationUser(req: any, res: any): Promise<void> {
    try {
        const body: AuthorizationRequestBody = req.body;

        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const Validation = `SELECT ID_user,Role, Firstname, Patronymic , Email, Password FROM Users WHERE Email = @email 
        AND Password = @password;`;
        const resultValidation = await pool.request()
            .input('email', sql.NChar, body.Email)
            .input('password', sql.NChar, body.Password)
            .query(Validation);
        if (resultValidation.recordset.length === 0) {
            res.status(401).json({
                message: 'Вы ввели неверный логин или пароль',
            });
        }
        else {
            const dataUser: UserData[] = resultValidation.recordset;
            const userId = resultValidation.recordset[0]['ID_user'];
            const userData = dataUser[0];
            const payload = { id: userId };
            const token = jwt.sign(payload, process.env.TOKEN_USER || '')
            res.cookie('jwt', token, {
                httpOnly: true, // Защищает от XSS атак
                secure: true, // Использовать только через HTTPS
                sameSite: 'none', // Защищает от CSRF атак
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
            });
            let uniqueIdFound = false;
            while (!uniqueIdFound) {
                try {
                    // Генерируем случайное значение
                    const tempIdUser = generateRandomSequence();
                    // Проверяем, существует ли такое значение в таблице
                    const checkQueryTemp = `
                    SELECT COUNT(*) as count FROM TempIDUser WHERE Temp_ID_User = @checkValue`;
                    const resultTemp = await pool.request()
                        .input('checkValue', sql.BigInt, tempIdUser)
                        .query(checkQueryTemp);

                    // Если такой записи нет, тогда вставляем новую запись
                    if (resultTemp.recordset[0].count === 0) {
                        console.log(`Уникальное значение найдено: ${tempIdUser}`);

                        // Добавление новой записи в таблицу
                        const insertQuery = `
                        UPDATE TempIDUser
                        SET Temp_ID_User = @newValue
                        WHERE ID_TrueUser = @idUser `;
                        await pool.request()
                            .input('newValue', sql.BigInt, tempIdUser)
                            .input('idUser', sql.BigInt, userId)
                            .query(insertQuery);

                        res.status(201).json({
                            message: 'Пользователь успешно авторизован!',
                            firstname: userData.Firstname,
                            patronymic: userData.Patronymic,
                            role: userData.Role,
                        });
                        uniqueIdFound = true;
                    } else {
                        console.log("Такое значение уже существует, генерируется новое...");
                    }
                } catch (error) {
                    console.error("Ошибка:");
                }
            }
        }



    } catch (error) {
        console.error('Error during authorization:', error);
        res.status(500).json({ message: 'An error occurred while authorization the user.' });
    }
}