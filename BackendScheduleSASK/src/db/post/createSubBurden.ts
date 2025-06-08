import * as sql from 'mssql';
import sqlConfig from '../config/config';
interface GeneralSubBurdenRequestBody {
    ID_TeacherPlan: bigint;
    NumeratorPlan: number;
    DenominatorPlan: number;
}

export default async function addSubGeneralBurden(req: any, res: any): Promise<void> {
    try {
        const body: GeneralSubBurdenRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        if (body.NumeratorPlan <= 0 && body.DenominatorPlan > 1) {
            res.status(409).json({
                firstmessage: 'Количество пар в числителе не должны быть ниже 1!',
                secondmessage: ''
            });
        } else if (body.DenominatorPlan <= 0 && body.NumeratorPlan > 1) {
            res.status(409).json({
                firstmessage: '',
                secondmessage: 'Количество пар в знаменателе не должны быть ниже 1!'
            });
        }
        else if (body.DenominatorPlan <= 0 && body.NumeratorPlan <= 0) {
            res.status(400).json({
                firstmessage: 'Количество пар в числителе не должны быть ниже 1!',
                secondmessage: 'Количество пар в знаменателе не должны быть ниже 1!'
            });
        }
        else {
            const checkGeneralBurdenQuery = `Select * From SubBurden
            Where ID_TeacherPlan = @id_TeacherPlan and
            NumeratorPlan = @numeratorPlan and
            DenominatorPlan = @denominatorPlan`;
            const resultCheck = await pool.request()
                .input('id_TeacherPlan', sql.BigInt, body.ID_TeacherPlan)
                .input('numeratorPlan', sql.Int, body.NumeratorPlan)
                .input('denominatorPlan', sql.Int, body.DenominatorPlan)
                .query(checkGeneralBurdenQuery);
            if (resultCheck.recordset.length > 0) {
                res.status(409).json({
                    secondmessage: 'У преподавателя уже распределены пары'
                });
            }
            else {
                const checkRecord = `
                    Select NumberHourInWeek From TeacherPlan
                    WHERE ID_TeacherPlan = @id_Teacher`;
                const ResultRecord = await pool.request()
                    .input('id_Teacher', sql.BigInt, body.ID_TeacherPlan)
                    .query(checkRecord);
                if (ResultRecord.recordset[0]['NumberHourInWeek'] === Number(body.NumeratorPlan) + Number(body.DenominatorPlan)) {
                    const insertQuery = `
                    INSERT INTO SubBurden (ID_TeacherPlan, NumeratorPlan, DenominatorPlan)
                    VALUES (@id_TeacherPlan, @numeratorPlan, @denominatorPlan);`;
                    const result = await pool.request()
                        .input('id_TeacherPlan', sql.BigInt, body.ID_TeacherPlan)
                        .input('numeratorPlan', sql.Int, body.NumeratorPlan)
                        .input('denominatorPlan', sql.Int, body.DenominatorPlan)
                        .query(insertQuery);
                    res.status(201).json({
                        successmessage: 'Учебная нагрузка успешно установленно!'
                    });
                }
                else if (ResultRecord.recordset[0]['NumberHourInWeek'] < body.NumeratorPlan + body.DenominatorPlan) {
                    console.log('Нехарош');
                    res.status(409).json({
                        secondmessage: 'Введённые данные превышают количество пар в неделю!'
                    });
                }
                else if (ResultRecord.recordset[0]['NumberHourInWeek'] !== body.NumeratorPlan + body.DenominatorPlan) {
                    res.status(409).json({
                        secondmessage: 'Пожалуйста, восполните все пары!'
                    });
                }
            }    
        }
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ secondmessage: 'Ошибка при распределении обязанности преподавателя.' });
    }
}