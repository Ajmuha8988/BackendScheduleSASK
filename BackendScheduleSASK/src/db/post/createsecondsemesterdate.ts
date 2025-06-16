import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface DateSecondSemesterBody {
    DateSecondSemester: string;
}

export default async function CreateDateSecondSemester(req: any, res: any): Promise<void> {
    try {
        const body: DateSecondSemesterBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const parts = body.DateSecondSemester.split('/');
        const convertedStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const myDate = new Date(convertedStr);
        console.log(myDate)
        const checkDateQuery = `SELECT COUNT(*) AS count FROM ValueSecondSemester
        WHERE ID_DateSecondSemester = 1;`;
        const resultCheck = await pool.request().input('dateSecondSemester', sql.Date, myDate).query(checkDateQuery);
            if (resultCheck.recordset[0].count > 0) {
                const updateQuery = `UPDATE ValueSecondSemester
                    SET DateSecondSemester = @dateSecondSemester
                    WHERE ID_DateSecondSemester = 1`;
                const result = await pool.request().input('dateSecondSemester', sql.Date, myDate).query(updateQuery);
                res.status(409).json({
                    message: 'Обновлена дата выхода на учёбу'
                });
            } else {
                const insertQuery = `
                INSERT INTO ValueSecondSemester (ID_DateSecondSemester ,DateSecondSemester)
                VALUES (1 ,@dateSecondSemester);`;
                const result = await pool.request().input('dateSecondSemester', sql.Date, myDate).query(insertQuery);
                res.status(201).json({
                    message: 'Назначен дата выхода на учёбу!'
                });
            }
        }   catch (error) {
        console.error('Error during add room:', error);
        res.status(500).json({ message: 'Ошибка при назначении даты выхода на учёбу.' });
    }
}