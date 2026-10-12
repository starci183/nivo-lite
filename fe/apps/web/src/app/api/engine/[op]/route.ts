import { NextResponse } from "next/server";
import { chatTurnCallback, chatTurnContext, generateCallback, generateInput, isToolName, runEngineTool, sweepEngineTimeouts, syncBundle, type CallbackBody } from "@/lib/engine-bridge";
import { loadRunningJob, queueDb, verifyEngineRequest } from "@/lib/engine-queue";
import { withErrorReport } from "@/lib/errors";
import { readVideoCallback, videoCallback, videoInput } from "@/lib/video/server";

/**
 * The engine's door into the app (public path: it is authenticated by an HMAC over the body with ENGINE_SHARED_SECRET, not by a session).
 *   POST /api/engine/context   { job_id }                      the system context + transcript of a chat.turn job
 *   POST /api/engine/callback  { job_id, op, text|reason }     the engine's PROPOSED reply (or "could not get one")
 *   POST /api/engine/tool      { job_id, tool, args }          a tool OpenClaw called through the engine's tool bridge
 *   POST /api/engine/sweep     (header x-sweep-secret)         pg_cron, every minute: answer chat.turn jobs the engine left queued or running too long with the direct model
 *   POST /api/engine/video-input { job_id }                    the spec of a video.render job; its results come back as callback ops video.progress / video.result / video.error (src/lib/video/server.ts)
 *   POST /api/engine/sync-bundle { job_id }                    the files of one agent's OpenClaw workspace, built from Supabase (job: openclaw.sync_agent, or a chat.turn whose agent has no copy yet)
 * The job id must name a RUNNING job; its workspace is the only workspace any of these can touch.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const numOf = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
/** The usage object the engine reports (tokens, cached tokens, cost, model); unknown fields are dropped. */
const usageOf = (v: unknown) => {
  if (!v || typeof v !== "object") return null;
  const u = v as Record<string, unknown>;
  return { prompt_tokens: numOf(u.prompt_tokens), completion_tokens: numOf(u.completion_tokens), cached_tokens: numOf(u.cached_tokens), cost: numOf(u.cost), model: typeof u.model === "string" ? u.model.slice(0, 120) : undefined };
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function postHandler(request: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  if (op === "sweep") {
    // Not signed by the engine (it may be down): authenticated by a secret that lives in the Vault and is compared inside Postgres.
    const db = queueDb();
    if (!db) return json({ error: "not configured" }, 503);
    const ok = await db.rpc("engine_sweep_authorized", { p_secret: request.headers.get("x-sweep-secret") ?? "" });
    if (ok.error || ok.data !== true) return json({ error: "unauthorized" }, 401);
    try {
      return json(await sweepEngineTimeouts(db));
    } catch (e) {
      console.error("engine sweep failed:", e instanceof Error ? e.message : e);
      return json({ error: "failed" }, 500);
    }
  }
  const raw = await request.text();
  if (!verifyEngineRequest(request.headers, raw)) return json({ error: "unauthorized" }, 401);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  if (op !== "context" && op !== "callback" && op !== "tool" && op !== "sync-bundle" && op !== "generate-input" && op !== "video-input") return json({ error: "not found" }, 404);

  const db = queueDb();
  if (!db) return json({ error: "not configured" }, 503);
  try {
    if (op === "sync-bundle") {
      const syncJob = await loadRunningJob(db, body.job_id, ["openclaw.sync_agent", "chat.turn"]);
      if (!syncJob) return json({ error: "no running job" }, 409);
      return json(await syncBundle(db, syncJob));
    }
    if (op === "video-input") {
      const videoJob = await loadRunningJob(db, body.job_id, "video.render");
      if (!videoJob) return json({ error: "no running job" }, 409);
      return json(await videoInput(db, videoJob));
    }
    if (op === "callback" && typeof body.op === "string" && body.op.startsWith("video.")) {
      const videoJob = await loadRunningJob(db, body.job_id, "video.render");
      if (!videoJob) return json({ error: "no running job" }, 409);
      const cb = readVideoCallback(body);
      if (!cb) return json({ error: "invalid callback" }, 400);
      return json(await videoCallback(db, videoJob, cb));
    }
    if (op === "generate-input") {
      const genJob = await loadRunningJob(db, body.job_id, "openclaw.generate");
      if (!genJob) return json({ error: "no running job" }, 409);
      return json(await generateInput(db, genJob));
    }
    if (op === "callback" && (body.op === "generate.result" || body.op === "generate.error")) {
      const genJob = await loadRunningJob(db, body.job_id, "openclaw.generate");
      if (!genJob) return json({ error: "no running job" }, 409);
      const timings = body.timings && typeof body.timings === "object" ? (body.timings as Record<string, number>) : null;
      return json(await generateCallback(db, genJob, body.op === "generate.result"
        ? { op: "generate.result", text: typeof body.text === "string" ? body.text.slice(0, 100_000) : "", usage: usageOf(body.usage), timings }
        : { op: "generate.error", reason: typeof body.reason === "string" ? body.reason : "error", timings }));
    }
    const job = await loadRunningJob(db, body.job_id, "chat.turn");
    if (!job) return json({ error: "no running job" }, 409);

    if (op === "context") return json(await chatTurnContext(db, job));

    if (op === "callback") {
      const cb: CallbackBody | null =
        body.op === "chat.reply" && typeof body.text === "string" ? { op: "chat.reply", text: body.text.slice(0, 20_000), usage: usageOf(body.usage), timings: null }
        : body.op === "chat.fallback" ? { op: "chat.fallback", reason: typeof body.reason === "string" ? body.reason : "" }
        : null;
      if (!cb) return json({ error: "invalid callback" }, 400);
      return json(await chatTurnCallback(db, job, cb));
    }

    if (!isToolName(body.tool)) return json({ error: "unknown tool" }, 404);
    const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? (body.args as Record<string, unknown>) : {};
    return json({ ok: true, result: await runEngineTool(db, job, body.tool, args) });
  } catch (e) {
    console.error(`engine ${op} failed:`, e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
}

export const POST = withErrorReport("api.engine", postHandler);
