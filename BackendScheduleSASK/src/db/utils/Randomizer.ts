function randomDigit(): bigint {
    return BigInt(Math.floor(Math.random() * 10));
}

// Генерация случайной строки из 10 символов
export default function generateRandomSequence(): bigint {
    let sequence = '';
    for (let i = 0; i < 10; i++) {
       sequence += randomDigit();
    }
    return BigInt(sequence);
}