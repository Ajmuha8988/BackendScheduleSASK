import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface RoomRequestBody {
    NameRoom: string;
}

export default async function addRoom(req: any, res: any): Promise<void> {
    try {
        const body: RoomRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const checkRoomQuery = `SELECT COUNT(*) AS count FROM Rooms
        WHERE NameRoom = @nameroom;`;
        const resultCheck = await pool.request().input('nameroom', sql.NVarChar, body.NameRoom).query(checkRoomQuery);
            if (resultCheck.recordset[0].count > 0) {
                res.status(409).json({
                    message: 'Такой кабинет уже существует'
                });
            } else {
                const insertQuery = `
                INSERT INTO Rooms (NameRoom)
                VALUES (@nameroom);`;
                const result = await pool.request().input('nameroom', sql.NVarChar, body.NameRoom).query(insertQuery);
                res.status(201).json({
                    message: 'Кабинет успешно создан!'
                });
            }
        }   catch (error) {
        console.error('Error during add room:', error);
        res.status(500).json({ message: 'Ошибка при создании кабинета.' });
    }
}