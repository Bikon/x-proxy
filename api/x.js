// /api/x.js — proxy to X (Twitter) API v2 with CORS + license enforcement + CDN cache
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const token = process.env.X_BEARER_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing X_BEARER_TOKEN env" });

    const { path = "", license = "", ttl, ...rest } = req.query;
    const qs = new URLSearchParams(rest);

    // 1) проверка лицензии (можно заменить на прямой вызов провайдера)
    try {
        const proto = "https://"; // Vercel всегда https
        const host  = req.headers.host;
        const check = await fetch(`${proto}${host}/api/license?key=${encodeURIComponent(license)}&host=${encodeURIComponent(req.headers.origin || "")}`);
        const lic   = await check.json().catch(() => ({ ok: false, plan: "free" }));
        const isPro = !!lic?.ok && (lic.plan === "pro");

        // 2) принудительный лимит для free
        if (String(path).startsWith("/users/") && String(path).includes("/tweets")) {
            const reqMax = Number(qs.get("max_results") || "10");
            const forced = isPro ? Math.min(reqMax, 100) : 5;
            qs.set("max_results", String(forced));
        }

        // 3) CDN-кэш (Vercel)
        let defaultTtl = 900; // 15 мин
        if (String(path).startsWith("/users/by/username")) defaultTtl = 3600; // 1 час
        const cacheTtl = Number(ttl || defaultTtl);

        const upstream = `https://api.twitter.com/2${path}${qs.toString() ? `?${qs}` : ""}`;
        const r = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });

        // уважаем rate-limit
        if (r.status === 429) {
            const retryAfter = r.headers.get("retry-after") || "60";
            res.setHeader("Retry-After", retryAfter);
            const data = await r.json().catch(() => ({}));
            return res.status(429).json({ error: "rate_limited", detail: data?.detail || "Too Many Requests", retryAfter });
        }

        const data = await r.json().catch(() => ({}));
        if (r.ok) res.setHeader("Cache-Control", `public, s-maxage=${cacheTtl}, stale-while-revalidate=${cacheTtl * 4}`);
        res.setHeader("x-feed-plan", isPro ? "pro" : "free");

        return res.status(r.status).json(data);
    } catch (e) {
        return res.status(502).json({ error: String(e) });
    }
}
