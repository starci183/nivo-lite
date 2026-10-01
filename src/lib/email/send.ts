import "server-only";
import type Mail from "nodemailer/lib/mailer";
import { translator } from "@/i18n/core";
import { email as dict } from "@/i18n/dict/email";
import { decryptSecret } from "../channels";
import { supabaseAdmin } from "../supabase/admin";
import { platformSender, sendThroughPlatform, sendThroughSmtp, type SmtpConfig, type SmtpErrorKind, SmtpFailure } from "./smtp";
import type { Security } from "./presets";

/**
 * Send one email for a workspace and record it in `email_messages`.
 *  - connection: `connectionId`, else the workspace default SMTP connection, else its oldest connected one.
 *  - no SMTP at all: owner-facing notices (`audience: "owner"`) fall back to the NIVO platform sender (env SMTP_URL / SMTP_FROM);
 *    customer-facing mail is NEVER sent from the platform sender and is recorded as `no_smtp`.
 *  - customer-facing mail (`audience: "customer"`, the default) is refused unless it carries the id of the work item whose authority gate
 *    approved it (`workItemId`); callers go through requestCustomerEmail (src/lib/email/request.ts), never around it.
 *  - a simple per-workspace rate limit protects the owner's mailbox and NIVO's name.
 */
export type EmailAttachment = { readonly filename: string; readonly content: string; readonly contentType?: string; readonly encoding?: "base64" | "utf8" };
export type EmailAudience = "owner" | "customer";
export type SendEmailInput = {
  readonly workspaceId: string;
  readonly connectionId?: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly attachments?: ReadonlyArray<EmailAttachment>;
  readonly purpose: string;
  readonly refs?: Readonly<Record<string, unknown>>;
  readonly audience?: EmailAudience;
  /** Customer-facing mail: the work item whose gate approved this send. */
  readonly workItemId?: string;
};
export type SendEmailStatus = "sent" | "failed" | "no_smtp" | "blocked" | "rate_limited";
export type SendEmailResult = {
  readonly status: SendEmailStatus;
  readonly emailMessageId: string | null;
  readonly messageId?: string;
  readonly via: "workspace" | "platform" | "none";
  /** Vietnamese, owner-readable. */
  readonly error?: string;
  readonly errorKind?: SmtpErrorKind | "no_smtp" | "gate" | "rate" | "recipient";
};

const HOURLY_LIMIT = 120;
const PLATFORM_DAILY_LIMIT = 20;
const MAX_ATTACHMENT_BYTES = 2_000_000;
const EMAIL_RE = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/;

export const isEmailAddress = (s: string): boolean => s.length <= 254 && EMAIL_RE.test(s);

const vi = translator(dict, "vi");

export const smtpErrorText = (kind: SmtpErrorKind): string => vi(`err_${kind}` as Parameters<typeof vi>[0]);

type Row = { id: string; public_meta: Record<string, string> | null };

/** The connection to send with, plus its decrypted config. Null when the workspace has no connected SMTP connection. */
export const resolveSmtp = async (workspaceId: string, connectionId?: string): Promise<{ id: string; config: SmtpConfig } | null> => {
  const db = supabaseAdmin();
  let q = db.from("connections").select("id, public_meta").eq("workspace_id", workspaceId).eq("provider", "smtp").eq("status", "connected");
  if (connectionId) q = q.eq("id", connectionId);
  const { data } = await q.order("is_default", { ascending: false }).order("created_at").limit(1);
  const row = ((data ?? []) as Array<Row>)[0];
  if (!row) return null;
  const { data: sec } = await db.from("connection_secrets").select("ciphertext").eq("connection_id", row.id).maybeSingle();
  if (!sec) return null;
  try {
    const m = row.public_meta ?? {};
    const { password } = JSON.parse(decryptSecret(sec.ciphertext as string)) as { password?: string };
    return {
      id: row.id,
      config: {
        host: m.host ?? "", port: Number(m.port ?? 587), security: (m.security === "tls" ? "tls" : "starttls") as Security, user: m.user ?? "", pass: password ?? "",
        fromName: m.from_name ?? "", fromEmail: m.from_email ?? "", replyTo: m.reply_to || undefined,
      },
    };
  } catch (e) {
    console.error("smtp credential could not be read", e instanceof Error ? e.message : e);
    return null;
  }
};

const record = async (input: SendEmailInput, r: { status: string; via: "workspace" | "platform" | "none"; connectionId?: string | null; messageId?: string; error?: string }): Promise<string | null> => {
  const { data, error } = await supabaseAdmin().from("email_messages").insert({
    workspace_id: input.workspaceId, connection_id: r.connectionId ?? null, to_address: input.to.slice(0, 254), subject: input.subject.slice(0, 300), purpose: input.purpose.slice(0, 60),
    status: r.status, via: r.via, provider_message_id: r.messageId ?? null, error: r.error?.slice(0, 600) ?? null,
    refs: { ...(input.refs ?? {}), ...(input.workItemId ? { work_item_id: input.workItemId } : {}) },
  }).select("id").single();
  if (error) console.error("email_messages insert failed", error.message);
  return (data?.id as string | undefined) ?? null;
};

const attachmentsOf = (list: SendEmailInput["attachments"]): Array<Mail.Attachment> | undefined => {
  if (!list?.length) return undefined;
  let total = 0;
  const out = list.slice(0, 3).map((a) => {
    const content = a.encoding === "base64" ? Buffer.from(a.content, "base64") : Buffer.from(a.content, "utf8");
    total += content.length;
    return { filename: a.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 80), content, contentType: a.contentType };
  });
  if (total > MAX_ATTACHMENT_BYTES) throw new SmtpFailure("limit", "attachment too large");
  return out;
};

export const sendWorkspaceEmail = async (input: SendEmailInput): Promise<SendEmailResult> => {
  const audience: EmailAudience = input.audience ?? "customer";
  const to = input.to.trim();
  const done = async (status: SendEmailStatus, via: "workspace" | "platform" | "none", extra: { connectionId?: string | null; messageId?: string; error?: string; errorKind?: SendEmailResult["errorKind"] } = {}): Promise<SendEmailResult> => {
    const emailMessageId = await record({ ...input, to }, { status, via, connectionId: extra.connectionId, messageId: extra.messageId, error: extra.error });
    return { status, via, emailMessageId, messageId: extra.messageId, error: extra.error, errorKind: extra.errorKind };
  };

  if (!isEmailAddress(to)) return done("blocked", "none", { error: vi("err_bad_recipient"), errorKind: "recipient" });
  if (audience === "customer" && !input.workItemId) return done("blocked", "none", { error: vi("err_gate"), errorKind: "gate" });

  const db = supabaseAdmin();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db.from("email_messages").select("id", { count: "exact", head: true }).eq("workspace_id", input.workspaceId).eq("status", "sent").gte("created_at", hourAgo);
  if ((count ?? 0) >= HOURLY_LIMIT) return done("rate_limited", "none", { error: vi("err_rate"), errorKind: "rate" });

  let attachments: Array<Mail.Attachment> | undefined;
  try {
    attachments = attachmentsOf(input.attachments);
  } catch (e) {
    const f = e instanceof SmtpFailure ? e : new SmtpFailure("unknown", "attachment");
    return done("blocked", "none", { error: smtpErrorText(f.kind), errorKind: f.kind });
  }

  const smtp = await resolveSmtp(input.workspaceId, input.connectionId);
  if (smtp) {
    try {
      const sent = await sendThroughSmtp(smtp.config, { to, subject: input.subject, html: input.html, text: input.text, attachments });
      return done("sent", "workspace", { connectionId: smtp.id, messageId: sent.messageId });
    } catch (e) {
      const f = e instanceof SmtpFailure ? e : new SmtpFailure("unknown", String(e));
      console.error("workspace email failed:", f.kind, f.detail.slice(0, 160));
      return done("failed", "workspace", { connectionId: smtp.id, error: `${smtpErrorText(f.kind)} (${f.detail.slice(0, 160)})`, errorKind: f.kind });
    }
  }

  // No workspace SMTP: only an owner notice may fall back to the NIVO platform sender.
  if (audience === "owner" && platformSender()) {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { count: used } = await db.from("email_messages").select("id", { count: "exact", head: true }).eq("workspace_id", input.workspaceId).eq("via", "platform").eq("status", "sent").gte("created_at", dayAgo);
    if ((used ?? 0) >= PLATFORM_DAILY_LIMIT) return done("rate_limited", "platform", { error: vi("err_rate"), errorKind: "rate" });
    try {
      const sent = await sendThroughPlatform({ to, subject: input.subject, html: input.html, text: input.text, attachments });
      return done("sent", "platform", { messageId: sent.messageId });
    } catch (e) {
      const f = e instanceof SmtpFailure ? e : new SmtpFailure("unknown", String(e));
      console.error("platform email failed:", f.kind, f.detail.slice(0, 160));
      return done("failed", "platform", { error: `${smtpErrorText(f.kind)} (${f.detail.slice(0, 160)})`, errorKind: f.kind });
    }
  }
  return done("no_smtp", "none", { error: vi("err_no_smtp"), errorKind: "no_smtp" });
};

/** True when the workspace can send customer-facing email (it has its own connected SMTP connection). */
export const hasWorkspaceSmtp = async (workspaceId: string): Promise<boolean> => (await resolveSmtp(workspaceId)) !== null;
