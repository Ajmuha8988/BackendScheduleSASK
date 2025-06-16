import jwt from 'jsonwebtoken';
interface ChangeGroupBody {
    NameGroup: string
}

export default async function changeGroup(req: any, res: any): Promise<void> {
    try {
        const body: ChangeGroupBody = req.body;
            // Генерируем JWT-токен
        const payload = { id: body.NameGroup };
        const token = jwt.sign(payload, process.env.TOKEN_GROUP || '', { expiresIn: '7d' });
            // Устанавливаем cookie
        res.cookie('jwtpuorg', token, {
                path: '/',           // Совпадает с предыдущими настройками
                secure: true,        // Опять используем secure
                httpOnly: true,      // Сохраняем HTTP Only
                sameSite: 'none',
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        console.log(token);
        res.status(201).json(token);
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Ошибка при редактировании.' });
    }
}