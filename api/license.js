// /api/license.js — простая заглушка проверки лицензии.
// Заменить на реальную валидацию (Lemon Squeezy/Gumroad/Stripe/Keygen) и кэшировать ответы.

export default async function handler(req, res) {
    const key  = String(req.query.key || "");
    const host = String(req.query.host || "");
    // Пример: ключ формата PRO-ABCDEFGH
    const ok = /^PRO-[A-Z0-9]{8}$/.test(key);
    // Здесь можно делать: проверку домена host, статуса подписки, лимитов, и т.д.
    return res.status(200).json({ ok, plan: ok ? "pro" : "free" });
}