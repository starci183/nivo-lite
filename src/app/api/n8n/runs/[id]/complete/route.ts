import { NextResponse, type NextRequest } from "next/server";
import { verifyRun } from "@/lib/n8n-pipelines";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/n8n/runs/:id/complete { status: done|failed|skipped, summary?, result? }: n8n reports how the run ended. The run token stops
 * working right after (the run row is closed), so a leaked token cannot be replayed.
 */
export const dynamic = "force-dynamic";

const STATUSES = new Set(["done", "failed", "skipped"]);

/** The Vietnamese words for the counters the shared workflows report (the workflows themselves carry no wording). */
const COUNT_TEXT: Record<string, string> = {
  sent: "đã gửi", waiting_decision: "chờ bạn quyết định", no_smtp: "chưa cấu hình email gửi đi", failed: "gửi lỗi", blocked: "bị chặn", rate_limited: "quá nhiều email",
  nothing_to_send: "không có gì để gửi", fetch_failed: "không lấy được dữ liệu", no_accountant_email: "chưa nhập email kế toán", invalid_payload: "dữ liệu không hợp lệ",
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await verifyRun(request.headers.get("authorization"), id);
  if (!run) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { status?: unknown; summary?: unknown; result?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "done";
  const counts = (body.result as { counts?: Record<string, unknown> } | undefined)?.counts;
  const summary = typeof body.summary === "string" ? body.summary.slice(0, 600)
    : counts && typeof counts === "object"
      ? Object.entries(counts).filter(([, n]) => typeof n === "number").map(([k, n]) => `${COUNT_TEXT[k] ?? k}: ${n}`).join(" · ").slice(0, 600) || null
      : null;
  const result = body.result && typeof body.result === "object" ? (JSON.stringify(body.result).length <= 8000 ? body.result : { truncated: true }) : null;
  const { error } = await supabaseAdmin().from("n8n_runs").update({ status, summary, result, finished_at: new Date().toISOString() }).eq("id", run.runId).eq("workspace_id", run.workspaceId);
  if (error) return NextResponse.json({ error: "could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
