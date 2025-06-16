export default function determineWeekType(startDate: Date, today: Date): string {
    // Получаем день недели начала семестра (0 - воскресенье, 1 - понедельник и т.д.)
    const startDay = startDate.getDay();
    // Проверяем первую неделю: если текущий день ещё раньше понедельника второй полной недели,
    // значит текущая неделя принадлежит первой (знаменатель)
    if (
        (today.getDay() > startDay || (today.getDay() === startDay && today.getHours() >= startDate.getHours())) &&
        (Math.abs(Math.floor((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))) < 7)
    ) {
        return 'Знаменатель';
    }

    // Преобразуем даты в эпохи
    const startEpoch = Math.floor(startDate.getTime() / 1000); // Epoch time in seconds
    const todayEpoch = Math.floor(today.getTime() / 1000);     // Epoch time in seconds

    // Разница в секундах
    const diffInSeconds = todayEpoch - startEpoch;

    // Переводим разницу в количество полных недель
    const fullWeeksSinceStart = Math.floor(diffInSeconds / (86400 * 7));

    // Возвращаем результат согласно чередованию: чётные - знаменатель, нечётные - числитель
    return fullWeeksSinceStart % 2 === 0 ? 'Знаменатель' : 'Числитель';
}