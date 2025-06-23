export default function ToDay(ctoday: Date): string {
    const daysOfWeekRu = [
        'Воскресенье', // индекс 0 соответствует воскресенью
        'Понедельник',
        'Вторник',
        'Среда',
        'Четверг',
        'Пятница',
        'Суббота'
    ];
    const dayIndex = ctoday.getDay(); // Получаем номер дня недели
    const dayName = daysOfWeekRu[dayIndex]; // По номеру получаем название дня
    return dayName; // Возвращаем название дня
}