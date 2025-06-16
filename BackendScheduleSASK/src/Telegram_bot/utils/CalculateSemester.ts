// Функция для получения массива дней текущей недели
export const calculateSemester = () => {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1; // месяцы нумеруются от 0 до 11, прибавляем единицу для удобства восприятия

    let semester: string;
    let dataSemester: string;

    if ([9, 10, 11, 12].includes(month)) { // Осень (сентябрь-декабрь)
        semester = '1-ый семестр';
        dataSemester = '1-ый';
    } else if ([1, 2, 3, 4, 5, 6].includes(month)) { // Весна (январь-июнь)
        semester = '2-ой семестр';
        dataSemester = '2-ой';
    } else {
        semester = 'Каникулы';
        dataSemester = 'Каникулы'
    }

    return { semester, dataSemester };
}