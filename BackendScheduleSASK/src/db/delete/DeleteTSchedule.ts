import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface TScheduleRequestBody {
    ID_TSchedule: bigint
}

export default async function deleteTSchedule(req: any, res: any): Promise<void> {
    try {
        const body: TScheduleRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const deleteQuery = `
		DELETE TSchedule
		WHERE ID_TSchedule = @teacherPlanId;`;
        const deleteResult = await pool.request()
            .input('teacherPlanId', sql.BigInt, body.ID_TSchedule)
            .query(deleteQuery);
        res.status(201).json({
            message: 'Запись успешно был удален из временного расписания!',
        });

    } catch (error) {
        console.error('Error during deleting:', error);
        res.status(500).json({ message: 'Ошибка при удаление записи из временного расписания.' });
    }
}