export default function determineWeekType(startDate: Date, today: Date): string {
    // Преобразуем даты в эпоху секунд
    const startEpoch = Math.floor(startDate.getTime() / 1000);
    const todayEpoch = Math.floor(today.getTime() / 1000);

    // Вычисляем абсолютную разницу в секундах
    const diffInSeconds = todayEpoch - startEpoch;

    // Переводим разницу в количество полных недель
    const fullWeeksSinceStart = Math.floor(diffInSeconds / (86400 * 7)); // 86400 = число секунд в сутках

    // Определяем тип недели: четная — знаменатель, нечетная — числитель
    return fullWeeksSinceStart % 2 === 0 ? 'Числитель' : 'Знаменатель';
}