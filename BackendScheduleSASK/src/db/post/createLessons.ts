import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface LessonRequestBody {
    NameLesson: string;
}

export default async function addLesson(req: any, res: any): Promise<void> {
    try {
        const body: LessonRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const checkLessonQuery = `SELECT COUNT(*) AS count FROM Lessons
        WHERE NameLesson = @namelesson;`;
        const resultCheck = await pool.request().input('namelesson', sql.NVarChar, body.NameLesson).query(checkLessonQuery);
            if (resultCheck.recordset[0].count > 0) {
                res.status(409).json({
                    message: 'Такой учебный предмет уже существует'
                });
            } else {
                const insertQuery = `
                INSERT INTO Lessons (NameLesson)
                VALUES (@namelesson);`;
                const result = await pool.request().input('namelesson', sql.NVarChar, body.NameLesson).query(insertQuery);
                res.status(201).json({
                    message: 'Учебный предмет успешно создан!'
                });
            }
        }   catch (error) {
        console.error('Error during add room:', error);
        res.status(500).json({ message: 'Ошибка при создании учебного предмета.' });
    }
}