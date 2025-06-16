import * as sql from 'mssql';
import sqlConfig from '../config/config';
import jwt from 'jsonwebtoken';
import generateRandomSequence from '../utils/Randomizer'
interface RegisterRequestBody {
    Lastname: string;
    Firstname: string;
    Patronymic: string;
    Email: string;
    Password: string;
    CallNumber: string;
    Role: string;
}
interface UserData {
    ID_user: bigint;
    Firstname: string;
    Patronymic: string;
    Role: string;
}

export default async function registerUser(req: any, res: any): Promise<void> {
    try {
        const body: RegisterRequestBody = req.body;

        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const checkEmailQuery = `SELECT COUNT(*) AS count FROM Users WHERE Email = @email;`;
        const resultCheck = await pool.request()
            .input('email', sql.NVarChar, body.Email)
            .query(checkEmailQuery);
        const checkCallNumberQuery = `SELECT COUNT(*) AS count FROM Users WHERE CallNumber = @callNumber;`;
        const resultCheckCall = await pool.request()
            .input('callNumber', sql.NVarChar, body.CallNumber)
            .query(checkCallNumberQuery);

        if (resultCheck.recordset[0].count > 0 && resultCheckCall.recordset[0].count > 0) {
            res.status(409).json({
                message: 'Пользователь с такой почтой уже существует',
                messagecall: 'Пользователь с таким номером телефона уже существует'
            });
        } else if (resultCheck.recordset[0].count > 0 && resultCheckCall.recordset[0].count === 0) {
            res.status(409).json({
                message: 'Пользователь с такой почтой уже существует',
                messagecall: ''
            });
        } else if (resultCheck.recordset[0].count === 0 && resultCheckCall.recordset[0].count > 0) {
            res.status(409).json({
                message: '',
                messagecall: 'Пользователь с таким номером телефона уже существует'
            });
        } else if (resultCheck.recordset[0].count === 0 && resultCheckCall.recordset[0].count === 0) {
            const insertQuery = `
                INSERT INTO Users (Lastname, Firstname, Patronymic, Email, Password, CallNumber, Role)
                OUTPUT inserted.ID_user
                VALUES (@lastname, @firstname, @patronymic, @email, @password, @callNumber, @role);`;
            const result = await pool.request()
                .input('lastname', sql.NVarChar, body.Lastname)
                .input('firstname', sql.NVarChar, body.Firstname)
                .input('patronymic', sql.NVarChar, body.Patronymic)
                .input('email', sql.NVarChar, body.Email)
                .input('password', sql.NVarChar, body.Password)
                .input('callNumber', sql.NVarChar, body.CallNumber)
                .input('role', sql.NVarChar, body.Role)
                .query(insertQuery);
            const userId = result.recordset[0]['ID_user'];

            // Генерируем JWT-токен
            const payload = { id: userId };
            const token = jwt.sign(payload, process.env.TOKEN_USER || '', { expiresIn: '7d' });

            // Устанавливаем cookie
            res.cookie('jwt', token, {
                path: '/',           // Совпадает с предыдущими настройками
                secure: true,        // Опять используем secure
                httpOnly: true,      // Сохраняем HTTP Only
                sameSite: 'none',
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
                        INSERT INTO TempIDUser(Temp_ID_User, ID_TrueUser) VALUES (@newValue, @idUser)`;
                        await pool.request()
                            .input('newValue', sql.BigInt, tempIdUser)
                            .input('idUser', sql.BigInt, userId)
                            .query(insertQuery);

                        res.status(201).json({
                            message: 'Пользователь успешно зарегистрировался!',
                            messagecall: ''
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
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Ошибка при регистрации пользователя.' });
    }
}