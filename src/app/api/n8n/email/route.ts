import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { oneLine, renderEmail, renderTemplate } from "@/lib/email/layout";
import { requestCustomerEmail } from "@/lib/email/request";
import { sendWorkspaceEmail, type EmailAttachment } from "@/lib/email/send";
import { PURPOSE_OF, n8nTemplateOf } from "@/lib/n8n-templates";
import { ownerRecipients, shopNameOf, verifyRun } from "@/lib/n8n-pipelines";

/**
 * POST /api/n8n/email: n8n asks NIVO to send ONE email of the running pipeline. Bearer = the run token (one run = one workspace).
 * Body: { to, variables: {ten_khach, so_tien, ...}, refs?, dedupe?, attachments?: [{filename, content, contentType?}] }.
 * NIVO renders the subject and body from the shop's approved template (n8n_pipelines.config) and the layout; n8n supplies only data.
 *   audience owner    (daily report, month ledger): the recipient must be an owner/manager of the workspace (or the configured accountant);
 *                     sent from the workspace default SMTP, else the NIVO platform sender.
 *   audience customer (receipt, debt reminder):      always goes through the authority gate (action send_email) and the workspace's own SMTP.
 * Always answers 200 with { status } once the run is authenticated, so a failed send does not make n8n retry blindly.
 */
export const dynamic = "force-dynamic";

const scalars = (v: unknown): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (/^[a-z0-9_]{1,40}$/i.test(k) && (typeof x === "string" || typeof x === "number")) out[k] = typeof x === "string" ? x.slice(0, 4000) : x;
  return out;
};
const refsOf = (v: unknown): Record<string, string | number | null> => {
  const out: Record<string, string | number | null> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (/^[a-z0-9_]{1,40}$/i.test(k) && (x === null || typeof x === "string" || typeof x === "number")) out[k] = typeof x === "string" ? x.slice(0, 200) : x;
  return out;
};
const attachmentsOf = (v: unknown): Array<EmailAttachment> =>
  (Array.isArray(v) ? v : []).slice(0, 2).flatMap((a) => {
    const x = a as { filename?: unknown; content?: unknown; contentType?: unknown; encoding?: unknown };
    return typeof x.filename === "string" && typeof x.content === "string"
      ? [{ filename: x.filename, content: x.content, contentType: typeof x.contentType === "string" ? x.contentType : undefined, encoding: x.encoding === "base64" ? ("base64" as const) : ("utf8" as const) }]
      : [];
  });

export async function POST(request: NextRequest) {
  const run = await verifyRun(request.headers.get("authorization"));
  const tpl = run ? n8nTemplateOf(run.templateKey) : null;
  if (!run || !tpl) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const subjectTpl = typeof run.config.subject === "string" ? run.config.subject : "";
  const bodyTpl = typeof run.config.body === "string" ? run.config.body : "";
  if (!to || !subjectTpl || !bodyTpl) return NextResponse.json({ error: "missing recipient or template" }, { status: 400 });

  const vars = scalars(body.variables);
  const refs = refsOf(body.refs);
  const purpose = PURPOSE_OF[run.templateKey] ?? "pipeline";
  const subject = oneLine(renderTemplate(subjectTpl, vars));
  const text = renderTemplate(bodyTpl, vars);
  const shop = String(vars.ten_shop ?? "") || (await shopNameOf(run.workspaceId));

  if (tpl.n8n.audience === "customer") {
    const dedupe = typeof body.dedupe === "string" && body.dedupe ? body.dedupe.slice(0, 120) : createHash("sha256").update(`${to}|${JSON.stringify(refs)}|${subject}`).digest("hex").slice(0, 32);
    const r = await requestCustomerEmail({
      workspaceId: run.workspaceId, to, subject, body: text, purpose, refs: { ...refs, run_id: run.runId }, dedupeKey: `send_email:${run.templateKey}:${dedupe}`,
      subjectType: tpl.key === "email-payment-receipt" ? "transaction" : "invoice", subjectId: typeof refs.transaction_id === "string" ? refs.transaction_id : typeof refs.invoice_id === "string" ? refs.invoice_id : null,
      leadId: typeof refs.lead_id === "string" ? refs.lead_id : null,
    });
    return NextResponse.json({ status: r.status, work_item_id: r.workItemId ?? null, email_message_id: r.emailMessageId ?? null, error: r.error ?? null });
  }

  // Owner-facing: only the workspace's owners/managers, plus the accountant address the owner typed in the pipeline settings.
  const allowed = new Set((await ownerRecipients(run.workspaceId)).map((o) => o.email));
  const accountant = typeof run.config.accountant_email === "string" ? run.config.accountant_email.trim().toLowerCase() : "";
  if (run.templateKey === "email-month-ledger" && accountant) allowed.add(accountant);
  if (!allowed.has(to)) return NextResponse.json({ status: "blocked", error: "recipient is not an owner of this workspace" }, { status: 403 });
  const mail = renderEmail({ shopName: shop, title: subject, body: text });
  const r = await sendWorkspaceEmail({
    workspaceId: run.workspaceId, to, subject, html: mail.html, text: mail.text, attachments: attachmentsOf(body.attachments), purpose, refs: { ...refs, run_id: run.runId }, audience: "owner",
  });
  return NextResponse.json({ status: r.status, via: r.via, email_message_id: r.emailMessageId, message_id: r.messageId ?? null, error: r.error ?? null });
}
