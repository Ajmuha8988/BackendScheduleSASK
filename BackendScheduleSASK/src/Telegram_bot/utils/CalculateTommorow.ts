export default function TomorrowDay(): string {
    const daysOfWeekRu = [
        'Воскресенье',
        'Понедельник',
        'Вторник',
        'Среда',
        'Четверг',
        'Пятница',
        'Суббота'
    ];

    // Получаем текущую дату
    const today = new Date();

    // Определяем день недели (0 - Воскресенье, 1 - Понедельник и т.д.)
    const dayIndex = today.getDay();

    // Выведем имя дня недели
    const dayName = daysOfWeekRu[dayIndex + 1];
    return dayName
}