import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface MembersRequestBody {
    ID_Groups: bigint;
    ID_Students: bigint;
}

export default async function addMembers(req: any, res: any): Promise<void> {
    try {
        const body: MembersRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const checkQuery = `
            WITH StudentList AS (
            SELECT Users.ID_user ,Temp_ID_User, Lastname, Firstname,
            Patronymic
            FROM Users
            INNER JOIN TempIDUser ON TempIDUser.ID_TrueUser = Users.ID_user
            LEFT JOIN Member_groups  ON Member_groups.ID_Students = Users.ID_user
            WHERE Member_groups.ID_Students IS NULL and Users.Role = 'Студент'
            )
	        Select ID_user
	        From Users
	        Where ID_user = (
	        Select ID_user
	        From StudentList
	        Where Temp_ID_User = @id_students
	    )`;
        const checkResult = await pool.request()
            .input('id_students', sql.BigInt, body.ID_Students)
            .query(checkQuery);

        const insertQuery = `
        INSERT INTO Member_groups (ID_Groups, ID_Students)
        VALUES (@id_Groups, @id_Students);`;
        const result = await pool.request()
            .input('id_Groups', sql.BigInt, body.ID_Groups)
            .input('id_Students', sql.BigInt, checkResult.recordset[0].ID_user)
                    .query(insertQuery);
        res.status(201).json({
              message: 'Студент успешно добавлен в группу!',
        });
            
    } catch (error) {
        console.error('Error during adding:', error);
        res.status(500).json({ message: 'Ошибка при добавление студента в группу.' });
    }
}