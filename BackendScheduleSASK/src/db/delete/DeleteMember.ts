import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface MembersRequestBody {
    ID_Students: bigint;
}

export default async function deleteMember(req: any, res: any): Promise<void> {
    try {
        const body: MembersRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const deleteQuery = `DELETE FROM Member_groups WHERE ID_members_group = @id_Students;`;
        const result = await pool.request()
            .input('id_Students', sql.BigInt, body.ID_Students)
            .query(deleteQuery);
        res.status(201).json({
            message: 'Студент успешно был удален из группы!',
        });

    } catch (error) {
        console.error('Error during deleting:', error);
        res.status(500).json({ message: 'Ошибка при удаление студента из группы.' });
    }
}