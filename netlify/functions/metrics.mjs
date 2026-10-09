import { getStore } from "@netlify/blobs";

// Aggregate events only: no identifiers, no cookies, no quiz answers, no customer data.
// Netlify's infrastructure may process request metadata under its own privacy terms.
const apps = ["home", "battery", "flag", "panic", "premium", "samebrain"];
const sources = ["ig_reel", "ig_story", "ig_bio", "ig_post", "fb_reel", "fb_post", "tiktok", "direct", "other"];
const events = ["visit", "start", "complete", "premium_click"];
const headers = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const storeForMetrics = () => getStore({ name: "kivzuno-funnel-v1", region: "eu-central-1", consistency: "strong" });
const valid = (value, choices) => typeof value === "string" && choices.includes(value);
const isoDay = (d) => d.toISOString().slice(0, 10);

export default async (request) => {
  const url = new URL(request.url);
  if (request.method === "POST") {
    // This is a small public, non-financial counter. Values are strictly allowlisted.
    if (request.headers.get("origin") !== url.origin) return reply({ error: "origin" }, 403);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 256) return reply({ error: "size" }, 413);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 256) return reply({ error: "size" }, 413);
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "json" }, 400);
    }
    const { app, event, source } = body || {};
    if (!valid(app, apps) || !valid(event, events) || !valid(source, sources)) {
      return reply({ error: "invalid event" }, 400);
    }
    if (app === "home" && event !== "visit") return reply({ error: "invalid combination" }, 400);
    if (event === "premium_click" && !["battery", "flag"].includes(app)) {
      return reply({ error: "invalid combination" }, 400);
    }
    const key = ["v1", isoDay(new Date()), source, app, event].join("/");
    try {
      const store = storeForMetrics();
      for (let i = 0; i < 8; i++) {
        const previous = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
        const count = previous ? Number(previous.data?.count) || 0 : 0;
        const write = await store.setJSON(
          key, { count: count + 1 },
          previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true }
        );
        if (write.modified) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      }
      return reply({ error: "busy" }, 503);
    } catch {
      return reply({ error: "unavailable" }, 503);
    }
  }

  if (request.method === "GET") {
    const days = Number(url.searchParams.get("days") || 7);
    if (![1, 7].includes(days)) return reply({ error: "days must be 1 or 7" }, 400);
    try {
      const store = storeForMetrics();
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
      const minimumDay = isoDay(cutoff);
      const listing = await store.list({ prefix: "v1/" });
      const filtered = listing.blobs.filter((item) => {
        const path = item.key.split("/");
        return path.length === 5 && path[1] >= minimumDay && path[1] <= isoDay(new Date()) &&
          valid(path[2], sources) && valid(path[3], apps) && valid(path[4], events);
      });
      if (filtered.length > 350) return reply({ error: "too many records to display", partial: true }, 503);
      const rows = await Promise.all(filtered.map(async (item) => {
        const entry = await store.get(item.key, { type: "json", consistency: "strong" });
        return { parts: item.key.split("/"), count: Math.max(0, Number(entry?.count) || 0) };
      }));
      const summary = { generatedAt: new Date().toISOString(), days, total: 0, byEvent: {}, byApp: {}, bySource: {}, daily: {} };
      for (const { parts, count } of rows) {
        const [, day, source, app, event] = parts;
        summary.total += count;
        summary.byEvent[event] = (summary.byEvent[event] || 0) + count;
        summary.byApp[app] ??= {};
        summary.byApp[app][event] = (summary.byApp[app][event] || 0) + count;
        summary.bySource[source] ??= {};
        summary.bySource[source][event] = (summary.bySource[source][event] || 0) + count;
        summary.daily[day] ??= {};
        summary.daily[day][event] = (summary.daily[day][event] || 0) + count;
      }
      return reply(summary);
    } catch {
      return reply({ error: "metrics unavailable — verify Netlify Functions and Blobs deployment" }, 503);
    }
  }
  return reply({ error: "method" }, 405);
};

export const config = { rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 50 } };
