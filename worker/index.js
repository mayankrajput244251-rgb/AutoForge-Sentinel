const page = __AUTOFORGE_PAGE__;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function pageResponse() {
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cleanId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,96}$/.test(text) ? text : null;
}

function cleanClientKey(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{12,96}$/.test(text) ? text : null;
}

function cleanText(value, limit = 180) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
}

function safeNumber(value, fallback = 0, min = 0, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function makeId(prefix) {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return prefix + "-" + Date.now().toString(36) + "-" + words[0].toString(36) + words[1].toString(36);
}

async function readJson(request) {
  const raw = await request.text();
  if (raw.length > 16384) throw new Error("Request is too large.");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid JSON request.");
  }
}

async function getSession(env, sessionId) {
  return env.DB.prepare(
    "SELECT id, client_key, batch_number, status, total_packets, passed_packets, warning_packets, rejected_packets, oee, last_risk, event_count, created_at, updated_at FROM batch_sessions WHERE id = ? LIMIT 1",
  ).bind(sessionId).first();
}

async function createSession(env, clientKey) {
  const latest = await env.DB.prepare(
    "SELECT COALESCE(MAX(batch_number), 0) AS max_batch FROM batch_sessions WHERE client_key = ?",
  ).bind(clientKey).first();
  const now = new Date().toISOString();
  const sessionId = makeId("ses");
  const batchNumber = safeNumber(latest?.max_batch, 0, 0, 999999) + 1;
  await env.DB.prepare(
    "INSERT INTO batch_sessions (id, client_key, batch_number, status, total_packets, passed_packets, warning_packets, rejected_packets, oee, last_risk, event_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(sessionId, clientKey, batchNumber, "running", 0, 0, 0, 0, 100, 0, 0, now, now).run();
  return getSession(env, sessionId);
}

async function sessionPayload(env, sessionId) {
  const session = await getSession(env, sessionId);
  if (!session) return null;
  const [packets, events, workOrders] = await Promise.all([
    env.DB.prepare(
      "SELECT packet_no, scanned_at, rpm, vibration, temperature, current, ai_result, auto_action, risk, created_at FROM packet_records WHERE session_id = ? ORDER BY created_at DESC LIMIT 24",
    ).bind(sessionId).all(),
    env.DB.prepare(
      "SELECT event_time, level, message, created_at FROM event_records WHERE session_id = ? ORDER BY created_at DESC LIMIT 24",
    ).bind(sessionId).all(),
    env.DB.prepare(
      "SELECT action, repair_time, maintenance_window, severity, status, created_at FROM maintenance_work_orders WHERE session_id = ? ORDER BY created_at DESC LIMIT 8",
    ).bind(sessionId).all(),
  ]);
  return {
    session,
    packets: packets.results || [],
    events: events.results || [],
    workOrders: workOrders.results || [],
    serverTime: new Date().toISOString(),
  };
}

async function requireSession(env, sessionId) {
  const session = await getSession(env, sessionId);
  if (!session) throw new Error("Batch session was not found.");
  return session;
}

async function handleApi(request, env) {
  if (!env.DB) {
    return json({ ok: false, error: "Database binding is unavailable." }, 503);
  }
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (method === "GET" && path === "/api/health") {
      await env.DB.prepare("SELECT 1 AS connected").first();
      return json({ ok: true, service: "AutoForge D1 backend", persistent: true, serverTime: new Date().toISOString() });
    }

    if (method === "POST" && path === "/api/bootstrap") {
      const body = await readJson(request);
      const clientKey = cleanClientKey(body.clientKey);
      if (!clientKey) return json({ ok: false, error: "A valid device key is required." }, 400);
      let session = await env.DB.prepare(
        "SELECT id FROM batch_sessions WHERE client_key = ? ORDER BY updated_at DESC LIMIT 1",
      ).bind(clientKey).first();
      if (!session) session = await createSession(env, clientKey);
      const payload = await sessionPayload(env, session.id);
      return json({ ok: true, ...payload });
    }

    if (method === "POST" && path === "/api/sessions/new") {
      const body = await readJson(request);
      const clientKey = cleanClientKey(body.clientKey);
      if (!clientKey) return json({ ok: false, error: "A valid device key is required." }, 400);
      const session = await createSession(env, clientKey);
      return json({ ok: true, session, serverTime: new Date().toISOString() });
    }

    if (method === "GET" && path.startsWith("/api/sessions/")) {
      const sessionId = cleanId(path.split("/").pop());
      if (!sessionId) return json({ ok: false, error: "Invalid session identifier." }, 400);
      const payload = await sessionPayload(env, sessionId);
      return payload ? json({ ok: true, ...payload }) : json({ ok: false, error: "Session not found." }, 404);
    }

    if (method === "POST" && path === "/api/packets") {
      const body = await readJson(request);
      const sessionId = cleanId(body.sessionId);
      if (!sessionId) return json({ ok: false, error: "Invalid session identifier." }, 400);
      await requireSession(env, sessionId);
      const packet = body.packet || {};
      const metrics = body.metrics || {};
      const packetNo = Math.round(safeNumber(packet.id, 0, 1, 999999));
      const aiResult = cleanText(packet.result, 16).toUpperCase();
      if (!packetNo || !["GOOD", "WARNING", "REJECT"].includes(aiResult)) {
        return json({ ok: false, error: "Packet data is incomplete." }, 400);
      }
      const now = new Date().toISOString();
      const total = Math.round(safeNumber(metrics.total, 0, 0, 999999));
      const passed = Math.round(safeNumber(metrics.passed, 0, 0, total));
      const warnings = Math.round(safeNumber(metrics.warnings, 0, 0, total));
      const rejected = Math.round(safeNumber(metrics.rejected, 0, 0, total));
      const oee = Math.round(safeNumber(metrics.oee, 0, 0, 100));
      const risk = Math.round(safeNumber(metrics.risk, 0, 0, 100));
      await env.DB.batch([
        env.DB.prepare(
          "INSERT OR REPLACE INTO packet_records (id, session_id, packet_no, scanned_at, rpm, vibration, temperature, current, ai_result, auto_action, risk, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          makeId("pkt"),
          sessionId,
          packetNo,
          cleanText(packet.at, 40) || now,
          Math.round(safeNumber(packet.rpm, 0, 0, 10000)),
          safeNumber(packet.vibration, 0, 0, 100).toFixed(3),
          safeNumber(packet.temperature, 0, -50, 500).toFixed(2),
          safeNumber(packet.current, 0, 0, 500).toFixed(3),
          aiResult,
          cleanText(packet.action, 180) || "No action recorded",
          risk,
          now,
        ),
        env.DB.prepare(
          "UPDATE batch_sessions SET status = ?, total_packets = ?, passed_packets = ?, warning_packets = ?, rejected_packets = ?, oee = ?, last_risk = ?, updated_at = ? WHERE id = ?",
        ).bind(cleanText(metrics.status, 20) || "running", total, passed, warnings, rejected, oee, risk, now, sessionId),
      ]);
      return json({ ok: true, stored: "packet", updatedAt: now });
    }

    if (method === "POST" && path === "/api/events") {
      const body = await readJson(request);
      const sessionId = cleanId(body.sessionId);
      if (!sessionId) return json({ ok: false, error: "Invalid session identifier." }, 400);
      await requireSession(env, sessionId);
      const event = body.event || {};
      const level = cleanText(event.kind, 16).toLowerCase() || "normal";
      const message = cleanText(event.text, 360);
      if (!message) return json({ ok: false, error: "Event message is required." }, 400);
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO event_records (id, session_id, event_time, level, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(makeId("evt"), sessionId, cleanText(event.at, 40) || now, level, message, now),
        env.DB.prepare(
          "UPDATE batch_sessions SET event_count = event_count + 1, updated_at = ? WHERE id = ?",
        ).bind(now, sessionId),
      ]);
      return json({ ok: true, stored: "event", updatedAt: now });
    }

    if (method === "POST" && path === "/api/work-orders") {
      const body = await readJson(request);
      const sessionId = cleanId(body.sessionId);
      if (!sessionId) return json({ ok: false, error: "Invalid session identifier." }, 400);
      await requireSession(env, sessionId);
      const order = body.workOrder || {};
      const action = cleanText(order.action, 180);
      if (!action) return json({ ok: false, error: "Work-order action is required." }, 400);
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO maintenance_work_orders (id, session_id, action, repair_time, maintenance_window, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          makeId("wo"),
          sessionId,
          action,
          cleanText(order.repair, 80) || "Not estimated",
          cleanText(order.window, 120) || "Manual review",
          cleanText(order.severity, 16) || "normal",
          "open",
          now,
        ),
        env.DB.prepare(
          "UPDATE batch_sessions SET updated_at = ? WHERE id = ?",
        ).bind(now, sessionId),
      ]);
      return json({ ok: true, stored: "work_order", updatedAt: now });
    }

    return json({ ok: false, error: "API route not found." }, 404);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Backend request failed." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) return handleApi(request, env);
    return pageResponse();
  },
};
