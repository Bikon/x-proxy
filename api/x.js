// Vercel Function: proxy to X API v2 with CORS
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const token = process.env.X_BEARER_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing X_BEARER_TOKEN env" });

    const { path = "", ttl, ...rest } = req.query;
    const qs = new URLSearchParams(rest).toString();
    const upstream = `https://api.twitter.com/2${path}${qs ? `?${qs}` : ""}`;

    // разумные TTL по умолчанию
    let defaultTtl = 60; // 60s для твитов
    if (String(path).startsWith("/users/by/username")) defaultTtl = 3600; // 1h для username -> id
    const cacheTtl = Number(ttl || defaultTtl);

    try {
        const r = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });

        // Если нас ограничили — пробросим Retry-After и более явное сообщение
        if (r.status === 429) {
            const retryAfter = r.headers.get("retry-after") || "60";
            res.setHeader("Retry-After", retryAfter);
            const data = await r.json().catch(() => ({}));
            return res.status(429).json({
                error: "rate_limited",
                detail: data?.detail || "Too Many Requests",
                retryAfter,
            });
        }

        const data = await r.json();

        // Включаем CDN-кэш Vercel
        if (r.ok) {
            res.setHeader(
                "Cache-Control",
                `public, s-maxage=${cacheTtl}, stale-while-revalidate=${cacheTtl * 10}`
            );
        }

        return res.status(r.status).json(data);
    } catch (e) {
        return res.status(502).json({ error: String(e) });
    }
}
