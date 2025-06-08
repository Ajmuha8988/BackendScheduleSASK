import * as sql from 'mssql';
import sqlConfig from '../config/config';
import * as jwt from 'jsonwebtoken';
interface GroupRequestBody {
    NameGroup: string;
}
interface JwtPayload {
    id: string | number; // Идентификатор пользователя (может быть строковым или числовым)
    iat: number;        // Время выдачи токена (issued at time)
    exp: number;        // Срок действия токена (expiration time)
}

export default async function addGroup(req: any, res: any): Promise<void> {
    try {
        const body: GroupRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.TOKEN_USER || '') as JwtPayload;
        console.log(decodedToken.id);
        const checkGroupQuery = `SELECT COUNT(*) AS count FROM Groups
        WHERE NameGroup = @namegroup;`;
        const resultCheck = await pool.request()
            .input('namegroup', sql.NVarChar, body.NameGroup)
            .query(checkGroupQuery);
        const checkGroupTeacherQuery = `SELECT COUNT(*) AS count FROM Groups
        WHERE ID_Teacher = @id_teacher;`;
        const resultCheckTeacher = await pool.request()
            .input('id_teacher', sql.BigInt, decodedToken.id)
            .query(checkGroupTeacherQuery);
        if (resultCheckTeacher.recordset[0].count > 0) {
            res.status(409).json({
                message: 'У вас уже есть группа'
            });
        }
        else {
            if (resultCheck.recordset[0].count > 0) {
                res.status(409).json({
                    message: 'Такая группа уже существует'
                });
            } else {
                const insertQuery = `
                INSERT INTO Groups (NameGroup, ID_Teacher)
                OUTPUT inserted.ID_Group
                VALUES (@namegroup, @id_teacher);`;
                const result = await pool.request()
                    .input('namegroup', sql.NVarChar, body.NameGroup)
                    .input('id_teacher', sql.BigInt, decodedToken.id)
                    .query(insertQuery);
                res.status(201).json({
                    message: 'Группа успешно создано!'
                });
            }
        }
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Ошибка при создании группы.' });
    }
}