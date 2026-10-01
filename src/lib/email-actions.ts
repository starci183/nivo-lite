"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/core";
import { email as dict } from "@/i18n/dict/email";
import { decryptSecret, encryptSecret, getConnection, randomSecret, type Connection } from "./channels";
import { renderEmail } from "./email/layout";
import { presetOf, type Security } from "./email/presets";
import { isEmailAddress } from "./email/send";
import { SmtpFailure, assertSmtpTarget, classifySmtpError, sendThroughSmtp, type SmtpConfig } from "./email/smtp";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/**
 * "Email gửi đi" (provider smtp): create a connection from the wizard, send the test email (the only way it becomes connected), change the
 * password, choose the default. Same rules as connection-actions.ts: owner | manager only, scoped to the caller workspace, service role,
 * the password is encrypted (AES-256-GCM) and never returned to the browser.
 */
type Tr = Translate<(typeof dict)["en"]>;
class UserError extends Error {}
const userError = (m: string) => new UserError(m);

const run = async <T>(fn: (tr: Tr) => Promise<T>): Promise<Outcome<T>> => {
  const tr = await getT(dict);
  try {
    return { ok: true, data: await fn(tr) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error("smtp action failed", e instanceof Error ? e.message : e);
    return { ok: false, error: tr("err_generic") };
  }
};

const now = () => new Date().toISOString();
const refresh = () => revalidatePath("/", "layout");
const clean = (v: string, max: number) => v.trim().slice(0, max);

export type SmtpInput = {
  readonly preset: string;
  readonly host: string;
  readonly port: number;
  readonly security: Security;
  readonly user: string;
  readonly password: string;
  readonly fromName: string;
  readonly fromEmail: string;
  readonly replyTo: string;
};
export type SmtpView = { readonly id: string; readonly host: string; readonly fromEmail: string; readonly isDefault: boolean };

const ownSmtp = async (ws: string, id: string, tr: Tr): Promise<Connection> => {
  const c = await getConnection(ws, id);
  if (!c || c.provider !== "smtp") throw userError(tr("err_none"));
  return c;
};

const failureText = (e: unknown, tr: Tr): string => {
  const f = classifySmtpError(e);
  return tr(`err_${f.kind}` as Parameters<Tr>[0]);
};

/** Wizard: validate the form and store the connection as PENDING (it turns connected only after a test email is sent). */
export const startSmtpConnection = async (input: SmtpInput): Promise<Outcome<SmtpView>> =>
  run(async (tr) => {
    const member = await requireManager();
    const preset = presetOf(input.preset);
    if (!preset) throw userError(tr("err_generic"));
    const host = clean(input.host, 253).toLowerCase();
    const fromName = clean(input.fromName, 80).replace(/[\r\n"<>]/g, "");
    const fromEmail = clean(input.fromEmail, 254).toLowerCase();
    const replyTo = clean(input.replyTo, 254).toLowerCase();
    const user = clean(input.user, 254);
    const password = input.preset === "gmail" || input.preset === "google_workspace" ? input.password.replace(/\s+/g, "") : input.password.trim();
    if (!host) throw userError(tr("err_host"));
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) throw userError(tr("err_port"));
    if (!fromName || !user || !fromEmail) throw userError(tr("err_fields"));
    if (!isEmailAddress(fromEmail) || (replyTo && !isEmailAddress(replyTo))) throw userError(tr("err_email"));
    if (!input.password.trim() && !(input.preset === "google_workspace" && input.host === "smtp-relay.gmail.com")) throw userError(tr("err_fields"));
    try {
      await assertSmtpTarget(host, input.port);
    } catch (e) {
      throw userError(failureText(e, tr));
    }
    const security: Security = input.security === "tls" ? "tls" : "starttls";
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("connections").insert({
      workspace_id: member.workspaceId, provider: "smtp", name: `${fromName} <${fromEmail}>`, status: "pending", environment: "live", created_by: member.userId,
      public_meta: { preset: input.preset, host, port: String(input.port), security, user, from_name: fromName, from_email: fromEmail, reply_to: replyTo },
    }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "connection not saved");
    const saved = await db.from("connection_secrets").insert({ connection_id: row.id, ciphertext: encryptSecret(JSON.stringify({ password })), webhook_secret: randomSecret() });
    if (saved.error) {
      await db.from("connections").delete().eq("id", row.id);
      throw new Error(saved.error.message);
    }
    refresh();
    return { id: row.id as string, host, fromEmail, isDefault: false };
  });

const configOf = async (c: Connection): Promise<SmtpConfig> => {
  const { data } = await supabaseAdmin().from("connection_secrets").select("ciphertext").eq("connection_id", c.id).maybeSingle();
  if (!data) throw new SmtpFailure("auth", "no stored password");
  const { password } = JSON.parse(decryptSecret(data.ciphertext as string)) as { password?: string };
  const m = c.meta;
  return {
    host: m.host ?? "", port: Number(m.port ?? 587), security: m.security === "tls" ? "tls" : "starttls", user: m.user ?? "", pass: password ?? "",
    fromName: m.from_name ?? "", fromEmail: m.from_email ?? "", replyTo: m.reply_to || undefined,
  };
};

/**
 * "Gửi email thử": send a real test message to an address the owner types. Success marks the connection connected (and the workspace default when it
 * has none); a failure keeps/sets the status and stores the plain-words reason on the connection.
 */
export const sendSmtpTest = async (connectionId: string, to: string, makeDefault: boolean): Promise<Outcome<{ to: string; isDefault: boolean }>> =>
  run(async (tr) => {
    const member = await requireManager();
    const ws = member.workspaceId;
    const c = await ownSmtp(ws, connectionId, tr);
    if (c.status === "disconnected") throw userError(tr("err_none"));
    const target = to.trim().toLowerCase();
    if (!isEmailAddress(target)) throw userError(tr("err_email"));
    const db = supabaseAdmin();
    const shop = ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "NIVO";
    const subject = tr("testSubject");
    const mail = renderEmail({ shopName: shop, title: subject, body: tr("testBody", { shop }) });
    let failure: string | null = null;
    let messageId = "";
    try {
      messageId = (await sendThroughSmtp(await configOf(c), { to: target, subject, html: mail.html, text: mail.text })).messageId;
    } catch (e) {
      failure = failureText(e, tr);
      console.error("smtp test failed:", classifySmtpError(e).kind);
    }
    await db.from("email_messages").insert({
      workspace_id: ws, connection_id: c.id, to_address: target, subject, purpose: "test", status: failure ? "failed" : "sent", via: "workspace",
      provider_message_id: messageId || null, error: failure, refs: {},
    });
    if (failure) {
      await db.from("connections").update({ status: c.status === "pending" ? "pending" : "error", last_error: failure, updated_at: now() }).eq("id", c.id);
      refresh();
      throw userError(failure);
    }
    await db.from("connections").update({ status: "connected", last_error: null, updated_at: now(), last_event_at: now() }).eq("id", c.id);
    const { data: current } = await db.from("connections").select("id").eq("workspace_id", ws).eq("provider", "smtp").eq("is_default", true).neq("status", "disconnected").limit(1);
    const hasDefault = Boolean(current?.length);
    let isDefault = hasDefault && current?.[0]?.id === c.id;
    if (makeDefault || !hasDefault) {
      await db.from("connections").update({ is_default: false }).eq("workspace_id", ws).eq("provider", "smtp").eq("is_default", true);
      await db.from("connections").update({ is_default: true }).eq("id", c.id);
      isDefault = true;
    }
    refresh();
    return { to: target, isDefault };
  });

/** "Đổi mật khẩu": the new password replaces the stored one; the connection must be tested again before it is trusted. */
export const changeSmtpPassword = async (connectionId: string, password: string): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await ownSmtp(member.workspaceId, connectionId, tr);
    if (c.status === "disconnected") throw userError(tr("err_none"));
    if (!password.trim()) throw userError(tr("err_password"));
    const db = supabaseAdmin();
    const { error } = await db.from("connection_secrets").update({ ciphertext: encryptSecret(JSON.stringify({ password: c.meta.preset === "gmail" || c.meta.preset === "google_workspace" ? password.replace(/\s+/g, "") : password.trim() })) }).eq("connection_id", c.id);
    if (error) throw new Error(error.message);
    await db.from("connections").update({ status: "pending", last_error: null, updated_at: now() }).eq("id", c.id);
    refresh();
    return true as const;
  });

/** Mark one connected SMTP connection as the workspace default (the others stop being default). */
export const setDefaultSmtp = async (connectionId: string): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await ownSmtp(member.workspaceId, connectionId, tr);
    if (c.status !== "connected") throw userError(tr("err_not_connected"));
    const db = supabaseAdmin();
    await db.from("connections").update({ is_default: false }).eq("workspace_id", member.workspaceId).eq("provider", "smtp").eq("is_default", true);
    const { error } = await db.from("connections").update({ is_default: true, updated_at: now() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });
