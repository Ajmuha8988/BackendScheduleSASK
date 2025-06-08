import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface GeneralBurdenRequestBody {
    ID_Teacher: bigint;
    FirstSemester: number;
    SecondSemester: number;
}

export default async function addGeneralBurden(req: any, res: any): Promise<void> {
    try {
        const body: GeneralBurdenRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        const quantityHour = Number(body.FirstSemester) + Number(body.SecondSemester);
        const checkGeneralBurdenQuery = `With ListGeneralBurden as (
		Select GeneralBurden.ID_Teacher
		From GeneralBurden
		Inner Join TempIDUser on TempIDUser.ID_TrueUser = GeneralBurden.ID_Teacher
		Where TempIDUser.Temp_ID_User = @id_teacher
	    )
	    Select ID_Teacher
	    From ListGeneralBurden`;
        console.log(body.ID_Teacher);
        const resultCheck = await pool.request()
            .input('id_teacher', sql.BigInt, body.ID_Teacher)
            .query(checkGeneralBurdenQuery);
        if (resultCheck.recordset.length > 0) {
            res.status(409).json({
                message: 'У преподавателя уже установлено учебная нагрузка'
            });
        }
        else {
                const checkTempQuery = `With ListTempUser as (
		        Select ID_user 
		        From Users
		        Inner Join TempIDUser on TempIDUser.ID_TrueUser = Users.ID_user
		        Where Temp_ID_User = @id_teacher
	            )
	            Select ID_user
	            From ListTempUser`;
                const resultTempCheck = await pool.request()
                .input('id_teacher', sql.BigInt, body.ID_Teacher)
                .query(checkTempQuery);
                const insertQuery = `
                INSERT INTO GeneralBurden (ID_Teacher, FirstSemesterHour, SecondSemesterHour, QuantityHour)
                OUTPUT inserted.ID_Burden
                VALUES (@id_teacher, @firstsemesterhour, @secondsemesterhour, @quantityhour);`;
                const result = await pool.request()
                    .input('id_teacher', sql.BigInt, resultTempCheck.recordset[0]['ID_user'])
                    .input('firstsemesterhour', sql.Int, body.FirstSemester)
                    .input('secondsemesterhour', sql.Int, body.SecondSemester)
                    .input('quantityhour', sql.Int, quantityHour)
                    .query(insertQuery);
                res.status(201).json({
                    message: 'Учебная нагрузка успешно установлено!'
                });
        }
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Ошибка при установке нагрузки преподавателя.' });
    }
}