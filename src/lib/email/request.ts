import "server-only";
import { runWork } from "../engine";
import { supabaseAdmin } from "../supabase/admin";
import { hasWorkspaceSmtp, isEmailAddress, smtpErrorText, type SendEmailResult } from "./send";
import { oneLine } from "./layout";

/**
 * The only way to send a customer-facing email. It creates a work item with the action `send_email` and lets the authority gate
 * decide: `auto` sends now, `ask` leaves the draft waiting in the owner's decisions (Quyết định) until they approve it.
 * A workspace with no SMTP connection of its own cannot send customer mail at all, so nothing is queued for approval; it is recorded as no_smtp.
 */
export type CustomerEmailInput = {
  readonly workspaceId: string;
  readonly to: string;
  readonly subject: string;
  /** Plain body, already rendered from the shop's approved template. */
  readonly body: string;
  readonly purpose: string;
  readonly refs: Readonly<Record<string, string | number | null>>;
  /** One request per business event: a retry of the same event never sends twice. */
  readonly dedupeKey: string;
  readonly subjectType?: "invoice" | "transaction" | "inbound";
  readonly subjectId?: string | null;
  readonly leadId?: string | null;
};
export type CustomerEmailResult = {
  readonly status: "sent" | "waiting_decision" | "no_smtp" | "failed" | "blocked" | "duplicate";
  readonly workItemId?: string;
  readonly emailMessageId?: string | null;
  readonly error?: string;
};

export const requestCustomerEmail = async (i: CustomerEmailInput): Promise<CustomerEmailResult> => {
  const db = supabaseAdmin();
  const to = i.to.trim();
  const record = async (status: "no_smtp" | "blocked", error: string) => {
    const { data } = await db.from("email_messages").insert({
      workspace_id: i.workspaceId, to_address: to.slice(0, 254), subject: i.subject.slice(0, 300), purpose: i.purpose, status, via: "none", error, refs: i.refs,
    }).select("id").single();
    return (data?.id as string | undefined) ?? null;
  };
  if (!isEmailAddress(to)) return { status: "blocked", error: smtpErrorText("recipient"), emailMessageId: await record("blocked", smtpErrorText("recipient")) };
  if (!(await hasWorkspaceSmtp(i.workspaceId))) {
    const error = "Chưa cấu hình email gửi đi: hãy kết nối một tài khoản SMTP trong Kết nối > Email gửi đi.";
    return { status: "no_smtp", error, emailMessageId: await record("no_smtp", error) };
  }
  const item = await runWork(
    { db, ws: i.workspaceId, actor: "NIVO", locale: "vi" },
    {
      action: "send_email", subject_type: i.subjectType ?? "inbound", subject_id: i.subjectId ?? null, lead_id: i.leadId ?? null, origin: "live",
      dedupeKey: i.dedupeKey, preset: true, noChain: true,
      seed: {
        summary: `Gửi email tới ${to}: ${oneLine(i.subject, 120)}`, draft: i.body,
        fields: { contact: to, subject: oneLine(i.subject), purpose: i.purpose, refs: JSON.stringify(i.refs) },
      },
    },
  );
  if (item.status === "done") return { status: "sent", workItemId: item.id };
  if (item.status === "waiting_decision") {
    const known = await db.from("email_messages").select("id").eq("workspace_id", i.workspaceId).eq("status", "waiting_decision").eq("refs->>work_item_id", item.id).limit(1);
    if (!known.data?.length) {
      await db.from("email_messages").insert({
        workspace_id: i.workspaceId, to_address: to.slice(0, 254), subject: i.subject.slice(0, 300), purpose: i.purpose, status: "waiting_decision", via: "none",
        refs: { ...i.refs, work_item_id: item.id },
      });
    }
    return { status: "waiting_decision", workItemId: item.id };
  }
  if (item.status === "failed") return { status: "failed", workItemId: item.id, error: item.error ?? undefined };
  return { status: "duplicate", workItemId: item.id };
};

export type { SendEmailResult };
