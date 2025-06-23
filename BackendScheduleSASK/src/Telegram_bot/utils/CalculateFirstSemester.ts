// Тип перечисления для обозначения типа недели
enum WeekType {
    Numerator,
    Denominator
}

// Функция возвращает номер недели относительно начала учебного года
export default function getAcademicWeek(date: Date): string {
    // Получаем текущий год
    const currentYear = date.getFullYear();

    // Определяем начало учебного года (первое сентября текущего года)
    const firstDay = new Date(currentYear, 8, 1); // сентябрь имеет индекс 8 (нумерация месяцев начинается с 0)

    // Проверяем, если первый день — воскресенье, переносим на понедельник следующей недели
    if (firstDay.getDay() === 0) {
        firstDay.setDate(firstDay.getDate() + 1); // Переносим на второй день месяца
    }

    // Вычисляем разницу в днях между заданной датой и началом учебного года
    let daysDiff = Math.floor((date.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));

    // Рассчитаем номер учебной недели (делим на 6 дней в неделе и округляем вверх)
    const weekNumber = Math.ceil((daysDiff + 1) / 6);

    // По четности номера определяем тип недели
    return `${weekNumber % 2 === 1 ? 'Числитель' : 'Знаменатель'}`;
}
