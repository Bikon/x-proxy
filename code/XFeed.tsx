// X (Twitter) Feed — Framer Code Component

import * as React from "react";
import { addPropertyControls, ControlType } from "framer";

/* ---------- client cache (localStorage) ---------- */
function k(url: string) { return `xfeed:v3:${url}`; }
function cacheGet(url: string, ttlMs: number) {
    if (!ttlMs) return null;
    try {
        const raw = localStorage.getItem(k(url));
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < ttlMs) return data;
        return null;
    } catch { return null; }
}
function cacheSet(url: string, data: any) {
    try { localStorage.setItem(k(url), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

/* ---------- linkify (@, #, urls) ---------- */
function Linkified({ text, theme }: { text: string; theme: "light" | "dark" }) {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    const re = /(https?:\/\/[^\s]+)|(@[A-Za-z0-9_]{1,15})|(#[\p{L}0-9_]+)|([^@#h]+)|([@#h])/gu;
    let m: RegExpExecArray | null;
    const linkColor = theme === "dark" ? "#7aa6ff" : "#0a66ff";
    while ((m = re.exec(text)) !== null) {
        const chunk = m[0];
        if (chunk.startsWith("http")) {
            parts.push(<a key={parts.length} href={chunk} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: linkColor }}>{chunk}</a>);
        } else if (chunk.startsWith("@")) {
            const u = chunk.slice(1);
            parts.push(<a key={parts.length} href={`https://x.com/${u}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: linkColor }}>{chunk}</a>);
        } else if (chunk.startsWith("#")) {
            const tag = chunk.slice(1);
            parts.push(<a key={parts.length} href={`https://x.com/hashtag/${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: linkColor }}>{chunk}</a>);
        } else {
            parts.push(<span key={parts.length}>{chunk}</span>);
        }
    }
    return <>{parts}</>;
}

/* ---------- helpers ---------- */
function normalizeTimeline(payload: any) {
    const byMediaKey = new Map<string, any>();
    if (payload?.includes?.media) for (const m of payload.includes.media) byMediaKey.set(m.media_key, m);
    const byUserId = new Map<string, any>();
    if (payload?.includes?.users) for (const u of payload.includes.users) byUserId.set(u.id, u);

    return (payload?.data || []).map((tw: any) => {
        const media: any[] = [];
        const keys: string[] = tw?.attachments?.media_keys || [];
        for (const k of keys) { const m = byMediaKey.get(k); if (m) media.push(m); }
        const author = byUserId.get(tw.author_id) || null;
        return {
            id: tw.id,
            text: tw.text || "",
            created_at: tw.created_at ? new Date(tw.created_at) : null,
            public_metrics: tw.public_metrics || {},
            media,
            author,
            permalink: `https://x.com/${author?.username || "i/web"}/status/${tw.id}`,
        };
    });
}

function Media({ m }: { m: any }) {
    const src = m.url || m.preview_image_url;
    if (!src) return null;
    const isVideo = m.type === "video" || m.type === "animated_gif";
    return (
        <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 12 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
            {isVideo && (
                <div style={{
                    position: "absolute", right: 8, bottom: 8,
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    borderRadius: 999, padding: "4px 8px", fontSize: 12,
                }}>▶︎</div>
            )}
        </div>
    );
}

function formatDateTime(d?: Date | null) {
    if (!d) return "";
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d); }
    catch { return d!.toString(); }
}

function Banner({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
    const bg = theme === "dark" ? "#0e0e10" : "#fff";
    const line = theme === "dark" ? "#222" : "#e5e7eb";
    const col = theme === "dark" ? "#e6e6e6" : "#111";
    return (
        <div style={{ border: `1px solid ${line}`, background: bg, borderRadius: 12, padding: 12, color: col }}>
            {children}
        </div>
    );
}

function Err({ theme, text }: { theme: "light" | "dark"; text: string }) {
    const bg = theme === "dark" ? "#0e0e10" : "#fff";
    const line = theme === "dark" ? "#222" : "#e5e7eb";
    const col = theme === "dark" ? "#ffb4b4" : "#a40000";
    return <div style={{ border: `1px solid ${line}`, background: bg, borderRadius: 12, padding: 16, color: col }}>Error: {text}</div>;
}

function Loading({ theme }: { theme: "light" | "dark" }) {
    const bg = theme === "dark" ? "#0e0e10" : "#fff";
    const line = theme === "dark" ? "#222" : "#e5e7eb";
    const sub = theme === "dark" ? "#9aa0a6" : "#6b7280";
    return (
        <div style={{ border: `1px dashed ${line}`, background: bg, borderRadius: 12, padding: 16, color: sub, textAlign: "center" }}>
            Loading…
        </div>
    );
}

/* ---------- Component ---------- */
export default function XFeed(props: any) {
    const {
        username,
        useProxy,
        proxyUrl,
        displayCount = 5,
        cacheMinutes = 15,
        showUserInfo = true,
        theme = "light",
        // metrics
        showLikes = true,
        showReplies = true,
        showRetweets = true,
        showQuotes = false,
        // licensing
        showMedia = true,
        licenseKey = "",
        proPurchaseUrl = "",
    } = props;

    const [tweets, setTweets] = React.useState<any[]>([]);
    const [user, setUser] = React.useState<any>(null);
    const [error, setError] = React.useState<string>("");
    const [plan, setPlan] = React.useState<"free" | "pro">("free");

    const colors = theme === "dark"
        ? { text: "#e6e6e6", sub: "#9aa0a6", cardBg: "#0e0e10", line: "#222", link: "#7aa6ff" }
        : { text: "#111",    sub: "#6b7280", cardBg: "#fff",    line: "#e5e7eb", link: "#0a66ff" };

    React.useEffect(() => {
        if (!username) return;
        if (!useProxy) { setError("Enable Proxy Mode and provide Proxy URL"); return; }
        if (!proxyUrl)  { setError("Proxy URL is empty"); return; }

        const limitRequested = Math.min(Math.max(Number(displayCount) || 5, 1), 100);
        const ttlMs = Math.max(0, Number(cacheMinutes || 0)) * 60_000;

        const run = async () => {
            try {
                // user by username
                const userUrl = `${proxyUrl}?path=/users/by/username/${encodeURIComponent(username)}&user.fields=name,username,profile_image_url,verified&license=${encodeURIComponent(licenseKey || "")}`;
                let u = cacheGet(userUrl, ttlMs);
                if (!u) {
                    const uRes = await fetch(userUrl);
                    if (!uRes.ok) throw new Error(`user ${uRes.status}`);
                    u = await uRes.json();
                    cacheSet(userUrl, u);
                    const planHdr = (uRes.headers?.get?.("x-feed-plan") || "").toLowerCase();
                    if (planHdr === "pro") setPlan("pro");
                }
                const uData = u?.data;
                if (!uData?.id) throw new Error("User not found");
                setUser(uData);

                // tweets
                const expansions = "attachments.media_keys,author_id";
                const tweetFields = "created_at,public_metrics,entities,attachments,possibly_sensitive,lang,author_id";
                const mediaFields = "media_key,type,url,preview_image_url,width,height,alt_text";
                const tweetsUrl =
                    `${proxyUrl}?path=/users/${uData.id}/tweets&max_results=${limitRequested}` +
                    `&tweet.fields=${tweetFields}&expansions=${expansions}&media.fields=${mediaFields}&user.fields=name,username` +
                    `&license=${encodeURIComponent(licenseKey || "")}`;
                let t = cacheGet(tweetsUrl, ttlMs);
                let planHdrLower = "";
                if (!t) {
                    const tRes = await fetch(tweetsUrl);
                    if (!tRes.ok) throw new Error(`tweets ${tRes.status}`);
                    t = await tRes.json();
                    cacheSet(tweetsUrl, t);
                    planHdrLower = (tRes.headers?.get?.("x-feed-plan") || "").toLowerCase();
                }
                if (!t?.data) throw new Error("No tweets found");

                if (planHdrLower === "pro") setPlan("pro");
                const normalized = normalizeTimeline(t);
                setTweets(normalized.slice(0, limitRequested));
                setError("");
            } catch (e: any) {
                setError(e.message || String(e));
                setTweets([]);
                setUser(null);
                setPlan("free");
            }
        };

        run();
    }, [username, useProxy, proxyUrl, displayCount, cacheMinutes, theme, licenseKey]);

    if (error) return <Err theme={theme} text={error} />;
    if (!tweets.length) return <Loading theme={theme} />;

    const isPro = plan === "pro";
    const effectiveShown = isPro ? tweets.length : Math.min(tweets.length, 5);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            color: colors.text,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: 6,
            scrollbarWidth: "thin",
            scrollbarColor: theme === "dark" ? "#555 #222" : "#bbb #f9f9f9",
        }}>
            {showUserInfo && user && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 12, padding: 10,
                    borderRadius: 12, border: `1px solid ${colors.line}`, background: colors.cardBg,
                }}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img src={user.profile_image_url} width={44} height={44} style={{ borderRadius: 999 }} />
                    <div style={{ lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 700 }}>{user.name}</div>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>@{user.username}</div>
                    </div>
                </div>
            )}

            {!isPro && displayCount > 5 && (
                <Banner theme={theme}>
                    You are using the free version — <b>maximum 5 posts</b>.<br />
                    Enter your <i>License Key</i> in the component properties to unlock more.
                    {proPurchaseUrl && (
                        <div style={{ marginTop: 8 }}>
                            <a href={proPurchaseUrl} target="_blank" rel="noreferrer" style={{ color: colors.link, textDecoration: "underline" }}>
                                Get Pro
                            </a>
                        </div>
                    )}
                    <div style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>
                        Requested: {displayCount}, displaying: 5
                    </div>
                </Banner>
            )}

            <div style={{ display: "grid", gap: 10 }}>
                {tweets.slice(0, effectiveShown).map((t: any) => (
                    <a
                        key={t.id}
                        href={t.permalink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            textDecoration: "none", color: colors.text,
                            border: `1px solid ${colors.line}`, background: colors.cardBg,
                            borderRadius: 12, padding: 12, display: "grid", gap: 10,
                        }}
                    >
                        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            <Linkified text={t.text} theme={theme} />
                        </div>

                        {showMedia && t.media?.length && (
                            <div style={{ display: "grid", gap: 8 }}>
                                {t.media.slice(0, 4).map((m: any) => <Media key={m.media_key} m={m} />)}
                            </div>
                        )}

                        {( (showLikes || showReplies || showRetweets || showQuotes) && t.public_metrics ) && (
                            <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12, opacity: 0.85 }}>
                                {showReplies  && typeof t.public_metrics.reply_count  === "number" && (<span title="Replies">💬 {t.public_metrics.reply_count}</span>)}
                                {showRetweets && typeof t.public_metrics.retweet_count=== "number" && (<span title="Retweets">🔁 {t.public_metrics.retweet_count}</span>)}
                                {showLikes    && typeof t.public_metrics.like_count   === "number" && (<span title="Likes">❤ {t.public_metrics.like_count}</span>)}
                                {showQuotes   && typeof t.public_metrics.quote_count  === "number" && (<span title="Quotes">🗨️ {t.public_metrics.quote_count}</span>)}
                            </div>
                        )}

                        <div style={{
                            fontSize: 12, color: colors.sub,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        }}>
                            {formatDateTime(t.created_at)}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

/* ---------- Property Controls ---------- */
addPropertyControls(XFeed, {
    username:     { type: ControlType.String, title: "Username", placeholder: "elonmusk" },
    useProxy:     { type: ControlType.Boolean, title: "Proxy Mode", defaultValue: true },
    proxyUrl:     { type: ControlType.String, title: "Proxy URL", placeholder: "https://your-vercel-app.vercel.app/api/x" },
    cacheMinutes: { type: ControlType.Number, title: "Cache (min)", defaultValue: 15, min: 0, max: 240, displayStepper: true },
    displayCount: { type: ControlType.Number, title: "Display Count", defaultValue: 5, min: 1, max: 100, displayStepper: true },
    showUserInfo: { type: ControlType.Boolean, title: "Show user info", defaultValue: true },
    theme:        { type: ControlType.Enum, title: "Theme", options: ["light", "dark"], optionTitles: ["Light", "Dark"], defaultValue: "light" },
    showLikes:    { type: ControlType.Boolean, title: "Likes", defaultValue: true },
    showReplies:  { type: ControlType.Boolean, title: "Replies", defaultValue: true },
    showRetweets: { type: ControlType.Boolean, title: "Retweets", defaultValue: true },
    showQuotes:   { type: ControlType.Boolean, title: "Quotes", defaultValue: false },
    showMedia:    { type: ControlType.Boolean, title: "Media", defaultValue: true },
    licenseKey:   { type: ControlType.String, title: "License Key", placeholder: "PRO-XXXXXXXX" },
    proPurchaseUrl:{ type: ControlType.String, title: "Buy Pro URL", placeholder: "https://…" },
});

(XFeed as any).defaultProps = {
    width: 720, height: 540,
    displayCount: 5,
    cacheMinutes: 15,
    showUserInfo: true,
    theme: "light",
    showLikes: true,
    showReplies: true,
    showRetweets: true,
    showQuotes: false,
    showMedia: true,
    licenseKey: "",
    proPurchaseUrl: "",
};
