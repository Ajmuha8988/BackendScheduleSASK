import * as sql from 'mssql';
import sqlConfig from '../config/config';
import jwt from 'jsonwebtoken';
import { calculateSemester } from '../utils/CalculateSemester'
interface PScheduleRequestBody {
    NameGroup: string;
    ID_Lesson: bigint;
    ID_Room: bigint;
    ID_user: bigint;
    NumberLesson: number;
    DaysOfWeek: string;
    KindOfSchedules: string;
    CombinedCouple: boolean;
}


export default async function addPSchedules(req: any, res: any): Promise<void> {
    const { dataSemester } = calculateSemester();
    try {
        const body: PScheduleRequestBody = req.body;
        // Подключение к базе данных
        const pool = await sql.connect(sqlConfig);
        if (body.CombinedCouple === true) {
            const checkQueryTwo = `SELECT ID_PSchedule, ID_user, ID_Room FROM PSchedule WHERE 
            ID_Group = (Select ID_Group From Groups Where NameGroup = @id_Groups) AND
            NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
            KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester ;`;
            const resultCheckTwo = await pool.request()
                .input('id_Groups', sql.NVarChar, body.NameGroup)
                .input('numberLessons', sql.Int, body.NumberLesson)
                .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                .input('kindofsemester', sql.NVarChar, dataSemester)
                .query(checkQueryTwo);
            const checkQueryTeachers = `SELECT ID_user, ID_Room FROM PSchedule WHERE
                ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_Teachers) AND
                NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;

            const resultCheckTeachers = await pool.request()
                .input('id_Teachers', sql.BigInt, body.ID_user)
                .input('numberLessons', sql.Int, body.NumberLesson)
                .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                .input('kindofsemester', sql.NVarChar, dataSemester)
                .query(checkQueryTeachers);
            const ValidateTeachersInRoom = `SELECT ID_user, ID_Room FROM PSchedule WHERE
                ID_Room = @id_rooms AND ID_Group = (Select ID_Group From Groups Where NameGroup = @id_Groups)
                AND NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
            console.log(dataSemester);
            console.log(body.ID_Room);
            console.log(body.NameGroup);
            console.log(body.NumberLesson);
            console.log(body.DaysOfWeek);
            console.log(body.KindOfSchedules);
            const resultValidateTeachersInRoom = await pool.request()
                .input('id_rooms', sql.BigInt, body.ID_Room)
                .input('id_Groups', sql.NVarChar, body.NameGroup)
                .input('numberLessons', sql.Int, body.NumberLesson)
                .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                .input('kindofsemester', sql.NVarChar, dataSemester)
                .query(ValidateTeachersInRoom);
            const ValidateTeachersInDay = `SELECT ID_Group FROM PSchedule WHERE
                                    ID_user = (Select ID_TrueUser  From TempIDUser Where Temp_ID_User = @id_Teachers) AND
                                    NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                                    KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;

            const resultValidateTeachersInDay = await pool.request()
                .input('id_Teachers', sql.BigInt, body.ID_user)
                .input('numberLessons', sql.Int, body.NumberLesson)
                .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                .input('kindofsemester', sql.NVarChar, dataSemester)
                .query(ValidateTeachersInDay);
            console.log(resultValidateTeachersInRoom.recordset.length);
            console.log(resultValidateTeachersInDay.recordset.length);
            if (resultValidateTeachersInRoom.recordset.length > 0 && resultValidateTeachersInDay.recordset.length > 0) {
                res.status(401).json({
                    errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                });
            } else {
                if (resultCheckTwo.recordset.length === 2) {
                    res.status(201).json({
                        errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                    });
                } else {
                    const checkQueryTwoTeachers = `SELECT ID_PSchedule FROM PSchedule WHERE
                ID_Group = (Select ID_Group From Groups Where NameGroup = @id_Groups) AND
                ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_Teachers) AND
                NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;

                    const resultCheckTwoTeachers = await pool.request()
                        .input('id_Groups', sql.NVarChar, body.NameGroup)
                        .input('id_Teachers', sql.BigInt, body.ID_user)
                        .input('numberLessons', sql.Int, body.NumberLesson)
                        .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                        .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .query(checkQueryTwoTeachers);
                    if (resultCheckTwoTeachers.recordset.length > 0) {
                        res.status(201).json({
                            errormessagefirst: 'Невозможно внести изменение в расписание, так как у преподавателя уже стоит пара в этой группе!'
                        });
                    } else {
                        if (resultCheckTeachers.recordset.length > 1) {
                            res.status(201).json({
                                errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                            });
                        } else {
                            if (resultCheckTwo.recordset.length === 0) {
                                if (resultCheckTeachers.recordset.length === 0) {
                                    const checkQueryRoom = `SELECT ID_PSchedule FROM PSchedule WHERE 
                                    ID_Room = @id_rooms AND
                                    NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                                    KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
                                    const resultCheckRoom = await pool.request()
                                        .input('id_rooms', sql.BigInt, body.ID_Room)
                                        .input('numberLessons', sql.Int, body.NumberLesson)
                                        .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                        .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                        .input('kindofsemester', sql.NVarChar, dataSemester)
                                        .query(checkQueryRoom);
                                    if (resultCheckRoom.recordset.length > 0) {
                                        res.status(201).json({
                                            errormessageroom: 'Кабинет занят!'
                                        });
                                    } else {
                                        const insertQuery = `
                                        INSERT INTO PSchedule (ID_Group, ID_Lesson, ID_Room, ID_user , NumberLessons, DaysOfWeek, KindOfSchedules, KindOfSemester)
                                        VALUES ((Select ID_Group From Groups Where NameGroup = @id_Groups), @id_Lesson, @id_Room,(Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User),
                                        @numberLessons, @daysofweek, @kindofschedules, @kindofsemester);`;
                                        const InsertedResult = await pool.request()
                                            .input('id_Groups', sql.NVarChar, body.NameGroup)
                                            .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                            .input('id_Room', sql.BigInt, body.ID_Room)
                                            .input('id_User', sql.BigInt, body.ID_user)
                                            .input('numberLessons', sql.Int, body.NumberLesson)
                                            .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                            .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                            .input('kindofsemester', sql.NVarChar, dataSemester)
                                            .query(insertQuery);
                                        const groupId = body.NameGroup;
                                        const payload = { id: groupId };
                                        const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
                                        res.cookie('jwtpuorg', token, {
                                            path: '/',           // Совпадает с предыдущими настройками
                                            secure: true,        // Опять используем secure
                                            httpOnly: true,      // Сохраняем HTTP Only
                                            sameSite: 'none',
                                            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                        });
                                        res.status(201).json({
                                            message: 'Успешно внесено совмещённая пара в расписании!'
                                        });
                                    }
                                } else {
                                    const id_user = resultCheckTeachers.recordset[0]['ID_user']
                                    const id_Room = resultCheckTeachers.recordset[0]['ID_Room']
                                    console.log(id_Room);
                                    console.log(body.ID_Room);
                                    const checkQueryGroups = `SELECT ID_Group FROM PSchedule WHERE
                                    ID_user = @id_Teachers AND
                                    NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                                    KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
                                    const resultCheckGroups = await pool.request()
                                        .input('id_Teachers', sql.BigInt, id_user)
                                        .input('numberLessons', sql.Int, body.NumberLesson)
                                        .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                        .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                        .input('kindofsemester', sql.NVarChar, dataSemester)
                                        .query(checkQueryGroups);
                                    if (resultCheckGroups.recordset.length === 2) {
                                        res.status(201).json({
                                            errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                                        });
                                    } else {
                                        if (id_Room !== body.ID_Room) {
                                            res.status(201).json({
                                                errormessageroom: 'Невозможно добавить совмещённую пару, так как кабинеты не совпадают!'
                                            });
                                        }
                                        else {
                                            if (resultCheckGroups.recordset.length === 0) {
                                                console.log('Пиздец5');
                                                const insertQuery = `
                                                INSERT INTO PSchedule (ID_Group, ID_Lesson, ID_Room, ID_user , NumberLessons, DaysOfWeek, KindOfSchedules, KindOfSemester)
                                                VALUES ((Select ID_Group From Groups Where NameGroup = @id_Groups), @id_Lesson, @id_Room,(Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User),
                                                @numberLessons, @daysofweek, @kindofschedules, @kindofsemester);`;
                                                const InsertedResult = await pool.request()
                                                    .input('id_Groups', sql.NVarChar, body.NameGroup)
                                                    .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                                    .input('id_Room', sql.BigInt, body.ID_Room)
                                                    .input('id_User', sql.BigInt, body.ID_user)
                                                    .input('numberLessons', sql.Int, body.NumberLesson)
                                                    .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                                    .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                                    .input('kindofsemester', sql.NVarChar, dataSemester)
                                                    .query(insertQuery);
                                                const groupId = body.NameGroup;
                                                const payload = { id: groupId };
                                                const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
                                                res.cookie('jwtpuorg', token, {
                                                    path: '/',           // Совпадает с предыдущими настройками
                                                    secure: true,        // Опять используем secure
                                                    httpOnly: true,      // Сохраняем HTTP Only
                                                    sameSite: 'none',
                                                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                                });
                                                res.status(201).json({
                                                    message: 'Успешно внесено совмещённая пара в расписании!'
                                                });
                                            } else {
                                                const id_group = resultCheckGroups.recordset[0]['ID_Group']
                                                const checkQueryValidateGroups = `SELECT ID_Group FROM PSchedule WHERE
                                                ID_Group = @id_Teachers AND
                                                NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                                                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
                                                const resultCheckValidateGroups = await pool.request()
                                                    .input('id_Teachers', sql.BigInt, id_group)
                                                    .input('numberLessons', sql.Int, body.NumberLesson)
                                                    .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                                    .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                                    .input('kindofsemester', sql.NVarChar, dataSemester)
                                                    .query(checkQueryValidateGroups);
                                                if (resultCheckValidateGroups.recordset.length === 2) {
                                                    res.status(201).json({
                                                        errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                                                    });
                                                }
                                                else {
                                                    const insertQuery = `
                                                    INSERT INTO PSchedule (ID_Group, ID_Lesson, ID_Room, ID_user , NumberLessons, DaysOfWeek, KindOfSchedules, KindOfSemester)
                                                    VALUES ((Select ID_Group From Groups Where NameGroup = @id_Groups), @id_Lesson, @id_Room,(Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User),
                                                    @numberLessons, @daysofweek, @kindofschedules, @kindofsemester);`;
                                                    const InsertedResult = await pool.request()
                                                        .input('id_Groups', sql.NVarChar, body.NameGroup)
                                                        .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                                        .input('id_Room', sql.BigInt, body.ID_Room)
                                                        .input('id_User', sql.BigInt, body.ID_user)
                                                        .input('numberLessons', sql.Int, body.NumberLesson)
                                                        .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                                        .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                                        .input('kindofsemester', sql.NVarChar, dataSemester)
                                                        .query(insertQuery);
                                                    const groupId = body.NameGroup;
                                                    const payload = { id: groupId };
                                                    const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
                                                    res.cookie('jwtpuorg', token, {
                                                        path: '/',           // Совпадает с предыдущими настройками
                                                        secure: true,        // Опять используем secure
                                                        httpOnly: true,      // Сохраняем HTTP Only
                                                        sameSite: 'none',
                                                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                                    });
                                                    res.status(201).json({
                                                        message: 'Успешно внесено совмещённая пара в расписании!'
                                                    });
                                                }
                                            }

                                        }
                                    }
                                }
                            } else {
                                const id_user = resultCheckTwo.recordset[0]['ID_user']
                                const id_Room = resultCheckTwo.recordset[0]['ID_Room']
                                const checkQueryGroups = `SELECT ID_Group FROM PSchedule WHERE
                                ID_user = @id_Teachers AND
                                NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
                                const resultCheckGroups = await pool.request()
                                    .input('id_Teachers', sql.BigInt, id_user)
                                    .input('numberLessons', sql.Int, body.NumberLesson)
                                    .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                    .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                    .input('kindofsemester', sql.NVarChar, dataSemester)
                                    .query(checkQueryGroups);
                                if (resultCheckGroups.recordset.length === 2) {
                                    res.status(201).json({
                                        errormessageteacher: 'Вы больше не можете добавлять совмещённые пары, ибо их колличество превышает допустимого!'
                                    });
                                } else {
                                    if (id_Room !== body.ID_Room) {
                                        res.status(201).json({
                                            errormessageroom: 'Невозможно добавить совмещённую пару, так как кабинеты не совпадают!'
                                        });
                                    }
                                    else {
                                        const insertQuery = `
                                        INSERT INTO PSchedule (ID_Group, ID_Lesson, ID_Room, ID_user , NumberLessons, DaysOfWeek, KindOfSchedules, KindOfSemester)
                                        VALUES ((Select ID_Group From Groups Where NameGroup = @id_Groups), @id_Lesson, @id_Room,(Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User),
                                        @numberLessons, @daysofweek, @kindofschedules, @kindofsemester);`;
                                        const InsertedResult = await pool.request()
                                            .input('id_Groups', sql.NVarChar, body.NameGroup)
                                            .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                            .input('id_Room', sql.BigInt, body.ID_Room)
                                            .input('id_User', sql.BigInt, body.ID_user)
                                            .input('numberLessons', sql.Int, body.NumberLesson)
                                            .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                            .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                            .input('kindofsemester', sql.NVarChar, dataSemester)
                                            .query(insertQuery);
                                        const groupId = body.NameGroup;
                                        const payload = { id: groupId };
                                        const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
                                        res.cookie('jwtpuorg', token, {
                                            path: '/',           // Совпадает с предыдущими настройками
                                            secure: true,        // Опять используем secure
                                            httpOnly: true,      // Сохраняем HTTP Only
                                            sameSite: 'none',
                                            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                        });
                                        res.status(201).json({
                                            message: 'Успешно внесено совмещённая пара в расписании!'
                                        });
                                    }

                                }
                            }

                        }
                    }

                }
            }
        } else {
            console.log(dataSemester);
            const checkQueryRoom = `SELECT ID_PSchedule FROM PSchedule WHERE 
            ID_Room = @id_rooms AND
            NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
            KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
            const resultCheckRoom = await pool.request()
                .input('id_rooms', sql.BigInt, body.ID_Room)
                .input('numberLessons', sql.Int, body.NumberLesson)
                .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                .input('kindofsemester', sql.NVarChar, dataSemester)
                .query(checkQueryRoom);
            if (resultCheckRoom.recordset.length > 0) {
                res.status(201).json({
                    errormessageroom: 'Кабинет занят!'
                });
            } else {
                const checkQuery = `SELECT ID_PSchedule FROM PSchedule WHERE 
                ID_Group = (Select ID_Group From Groups Where NameGroup = @id_Groups) AND
                NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;

                const resultCheck = await pool.request()
                    .input('id_Groups', sql.NVarChar, body.NameGroup)
                    .input('numberLessons', sql.Int, body.NumberLesson)
                    .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                    .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                    .input('kindofsemester', sql.NVarChar, dataSemester)
                    .query(checkQuery);

                if (resultCheck.recordset.length > 0) {
                    res.status(201).json({
                        errormessagefirst: 'В это время уже установлено пара! Пожалуйста, выберите другое время'
                    });

                } else {
                    const checkQueryTeacher = `SELECT ID_PSchedule FROM PSchedule WHERE 
                    ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_Teachers) AND
                    NumberLessons = @numberLessons AND DaysOfWeek = @daysofweek AND
                    KindOfSchedules = @kindofschedules AND KindOfSemester = @kindofsemester;`;
                    const resultCheckTeacher = await pool.request()
                        .input('id_Teachers', sql.BigInt, body.ID_user)
                        .input('numberLessons', sql.Int, body.NumberLesson)
                        .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                        .input('kindofsemester', sql.NVarChar, dataSemester)
                        .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                        .query(checkQueryTeacher);
                        console.log(body.ID_user);
                        console.log(body.NumberLesson);
                        console.log(body.DaysOfWeek);
                        console.log(body.KindOfSchedules);
                        console.log(resultCheckTeacher.recordset.length);
                        if (resultCheckTeacher.recordset.length > 0) {
                           res.status(201).json({
                             errormessageteacher: 'В это время уже установлено пара у преподавателя! Пожалуйста, выберите другое время'
                        });
                        }
                        else {
                           const checkQueryHourFirstSemestr = `Select ID_SubBurden
                           From SubBurden
                           Where ID_TeacherPlan = (
	                       Select ID_TeacherPlan
	                       From TeacherPlan
	                       Where ID_Lesson = @id_Lesson and ID_Group = (
		                     Select ID_Group
		                     From Groups
		                     Where NameGroup = @id_Groups
	                        ) and KindOfSemester = '1-ый' and ID_Teacher = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User)
                            ) and (NumeratorPlan = (
	                        Select Count(ID_Group)
	                        From PSchedule
	                        Where ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User) and ID_Group = (
		                        Select ID_Group
		                        From Groups
		                        Where NameGroup = @id_Groups
	                        ) and ID_Lesson = @id_Lesson and KindOfSchedules = @kindofschedules
                            ) or DenominatorPlan = (
	                        Select Count(ID_Group)
	                        From PSchedule
	                        Where ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User) and ID_Group = (
		                       Select ID_Group
		                       From Groups
		                       Where NameGroup = @id_Groups
	                        ) and ID_Lesson = @id_Lesson and KindOfSchedules = @kindofschedules
                            ))`;
                            const resultCheckHourFirstSemestr = await pool.request()
                                .input('id_Groups', sql.NVarChar, body.NameGroup)
                                .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                .input('id_User', sql.BigInt, body.ID_user)
                                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                .query(checkQueryHourFirstSemestr);
                            if (resultCheckHourFirstSemestr.recordset.length > 0) {
                                res.status(201).json({
                                    errormessagehour: 'Вы больше не можете назначить пару, так как вы превышаете установленную нагрузку на преподавателя'
                                });

                            } else {
                                const checkQueryHourSecondSemestr = `Select ID_SubBurden
                                From SubBurden
                                Where ID_TeacherPlan = (
	                            Select ID_TeacherPlan
	                            From TeacherPlan
	                            Where ID_Lesson = @id_Lesson and ID_Group = (
		                            Select ID_Group
		                            From Groups
		                            Where NameGroup = @id_Groups
	                            ) and KindOfSemester = '2-ой' and ID_Teacher = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User)
                                ) and (NumeratorPlan = (
	                            Select Count(ID_Group)
	                            From PSchedule
	                            Where ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User) and ID_Group = (
		                            Select ID_Group
		                            From Groups
		                            Where NameGroup = @id_Groups
	                            ) and ID_Lesson = @id_Lesson and KindOfSchedules = @kindofschedules
                                ) or DenominatorPlan = (
	                                Select Count(ID_Group)
	                                From PSchedule
	                                Where ID_user = (Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User) and ID_Group = (
		                                Select ID_Group
		                                From Groups
		                                Where NameGroup = @id_Groups
	                            ) and ID_Lesson = @id_Lesson and KindOfSchedules = @kindofschedules
                            ))`;
                            const resultCheckHourSecondSemestr = await pool.request()
                                .input('id_Groups', sql.NVarChar, body.NameGroup)
                                .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                .input('id_User', sql.BigInt, body.ID_user)
                                .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                .query(checkQueryHourSecondSemestr);
                            if (resultCheckHourSecondSemestr.recordset.length > 0) {
                                res.status(201).json({
                                    errormessagehour: 'Вы больше не можете назначить пару, так как вы превышаете установленную нагрузку на преподавателя'
                                });
                            } else {
                                console.log("Это где-то здесь?");
                                const insertQuery = `
                                                INSERT INTO PSchedule (ID_Group, ID_Lesson, ID_Room, ID_user , NumberLessons, DaysOfWeek, KindOfSchedules, KindOfSemester)
                                                VALUES ((Select ID_Group From Groups Where NameGroup = @id_Groups), @id_Lesson, @id_Room,(Select ID_TrueUser From TempIDUser Where Temp_ID_User = @id_User),
                                                @numberLessons, @daysofweek, @kindofschedules, @kindofsemester);`;
                                const InsertedResult = await pool.request()
                                    .input('id_Groups', sql.NVarChar, body.NameGroup)
                                    .input('id_Lesson', sql.BigInt, body.ID_Lesson)
                                    .input('id_Room', sql.BigInt, body.ID_Room)
                                    .input('id_User', sql.BigInt, body.ID_user)
                                    .input('numberLessons', sql.Int, body.NumberLesson)
                                    .input('daysofweek', sql.NVarChar, body.DaysOfWeek)
                                    .input('kindofschedules', sql.NVarChar, body.KindOfSchedules)
                                    .input('kindofsemester', sql.NVarChar, dataSemester)
                                    .query(insertQuery);
                                const groupId = body.NameGroup;
                                const payload = { id: groupId };
                                const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
                                res.cookie('jwtpuorg', token, {
                                    path: '/',           // Совпадает с предыдущими настройками
                                    secure: true,        // Опять используем secure
                                    httpOnly: true,      // Сохраняем HTTP Only
                                    sameSite: 'none',
                                    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                });
                                res.status(201).json({
                                    message: 'Успешно внесены изменения в расписании!'
                                });
                            }
                        }

                    }
                }
            
            }
        }
    } catch (error) {
        console.error('Error during adding:', error);
        res.status(500).json({ message: 'Ошибка при процессе редактирование расписание.' });
    }
}