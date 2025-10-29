// Vercel Function: proxy to X API v2 with CORS
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const token = process.env.X_BEARER_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing X_BEARER_TOKEN env" });

    const { path = "", ...rest } = req.query;                   // ?path=/users/by/username/...
    const qs = new URLSearchParams(rest).toString();
    const upstream = `https://api.twitter.com/2${path}${qs ? `?${qs}` : ""}`;

    try {
        const r = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json();
        return res.status(r.status).json(data);
    } catch (e) {
        return res.status(502).json({ error: String(e) });
    }
}
