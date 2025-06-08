import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface PScheduleRequestBody {
    ID_PSchedule: bigint
}

export default async function deletePSchedule(req: any, res: any): Promise<void> {
    try {
        const body: PScheduleRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const deleteQuery = `
		DELETE PSchedule
		WHERE ID_PSchedule = @teacherPlanId;`;
        const deleteResult = await pool.request()
            .input('teacherPlanId', sql.BigInt, body.ID_PSchedule)
            .query(deleteQuery);
        res.status(201).json({
            message: 'Запись успешно был удален из постоянного расписания!',
        });

    } catch (error) {
        console.error('Error during deleting:', error);
        res.status(500).json({ message: 'Ошибка при удаление записи из постоянного расписания.' });
    }
}