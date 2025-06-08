import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface MembersRequestBody {
    ID_Groups: bigint;
}

export default async function removeGroup(req: any, res: any): Promise<void> {
    try {
        const body: MembersRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const deleteQuery = `DELETE FROM Member_groups WHERE ID_Groups = @id_Groups;
        DELETE FROM Groups WHERE ID_Group = @id_Groups;
        DELETE FROM PSchedule WHERE ID_Group = @id_Groups;`;
        const result = await pool.request()
            .input('id_Groups', sql.BigInt, body.ID_Groups)
            .query(deleteQuery);
            res.status(201).json({
            message: 'Группа успешно была удалена!',
        });

    } catch (error) {
        console.error('Error during deleting:', error);
        res.status(500).json({ message: 'Ошибка при удаление группы.' });
    }
}