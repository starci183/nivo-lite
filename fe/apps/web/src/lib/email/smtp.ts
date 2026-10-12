import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type Mail from "nodemailer/lib/mailer";
import { publicSiteUrl } from "../channels";
import type { Security } from "./presets";

/** What a workspace SMTP connection needs to send (the password comes from connection_secrets, decrypted by the caller). */
export type SmtpConfig = {
  readonly host: string;
  readonly port: number;
  readonly security: Security;
  readonly user: string;
  readonly pass: string;
  readonly fromName: string;
  readonly fromEmail: string;
  readonly replyTo?: string;
};

/** Why a send failed, in terms the owner can act on. The Vietnamese/English text lives in the `email` dictionary (errors_<kind>). */
export type SmtpErrorKind = "auth" | "app_password" | "connect" | "timeout" | "dns" | "tls" | "sender" | "recipient" | "limit" | "unknown";
export class SmtpFailure extends Error {
  constructor(readonly kind: SmtpErrorKind, readonly detail: string) {
    super(`${kind}: ${detail}`);
  }
}

const PUBLIC_PORTS = new Set([25, 465, 587, 2465, 2525, 2587]);

const isPrivate = (address: string): boolean => {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(a) === 6) {
    if (a === "::1" || a === "::") return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivate(mapped[1]) : /^(fc|fd|fe[89ab])/.test(a);
  }
  const p = a.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [x, y] = p;
  return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127);
};

/** Local development (the site itself runs on localhost) may point at a local mail catcher; production may only reach public mail servers. */
const allowsPrivate = (): boolean => publicSiteUrl() === null || process.env.SMTP_ALLOW_PRIVATE_HOSTS === "1";

/** The host is chosen by the workspace owner: it must be a public mail server on a mail port, never an address inside our network. */
export const assertSmtpTarget = async (host: string, port: number): Promise<void> => {
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i.test(host) || host.includes("..")) throw new SmtpFailure("dns", host);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new SmtpFailure("connect", `port ${port}`);
  if (allowsPrivate()) return;
  if (!PUBLIC_PORTS.has(port)) throw new SmtpFailure("connect", `port ${port} is not a mail port`);
  let addresses: Array<string>;
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  } catch {
    throw new SmtpFailure("dns", host);
  }
  if (!addresses.length || addresses.some(isPrivate)) throw new SmtpFailure("connect", "private address");
};

const transportOptions = (c: SmtpConfig): SMTPTransport.Options => ({
  host: c.host,
  port: c.port,
  secure: c.security === "tls",
  requireTLS: c.security === "starttls" && !allowsPrivate(),
  // A mail catcher on localhost has a self-signed certificate; a real server must present a valid one.
  tls: { rejectUnauthorized: !allowsPrivate(), minVersion: "TLSv1.2" },
  auth: c.user || c.pass ? { user: c.user, pass: c.pass } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 25_000,
  name: "nivo.vn",
});

/** Map a nodemailer / SMTP failure to what the owner should do about it. */
export const classifySmtpError = (e: unknown): SmtpFailure => {
  if (e instanceof SmtpFailure) return e;
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string; command?: string };
  const text = `${err.response ?? ""} ${err.message ?? ""}`.slice(0, 300);
  const detail = text.replace(/\s+/g, " ").trim();
  if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534 || /authentication|credentials|username and password/i.test(text)) {
    return new SmtpFailure(/application-specific|app password|5\.7\.9|apppasswords/i.test(text) ? "app_password" : "auth", detail);
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNTIMEOUT" || /timed? ?out|greeting never received/i.test(text)) return new SmtpFailure("timeout", detail);
  if (err.code === "ENOTFOUND" || err.code === "EDNS" || /getaddrinfo|ENOTFOUND/i.test(text)) return new SmtpFailure("dns", detail);
  if (err.code === "ECONNREFUSED" || err.code === "ECONNECTION" || err.code === "ECONNRESET" || err.code === "EHOSTUNREACH") return new SmtpFailure("connect", detail);
  if (/certificate|ssl|tls|wrong version number|handshake|self[- ]signed|STARTTLS/i.test(text) || err.code === "ESOCKET") return new SmtpFailure("tls", detail);
  if (err.code === "EENVELOPE" || /recipient|user unknown|mailbox unavailable|no such user/i.test(text)) {
    if (/sender|from|send as|not (owned|allowed|permitted)|5\.7\.60|not authenticated|relay/i.test(text) && !/recipient|user unknown/i.test(text)) return new SmtpFailure("sender", detail);
    return new SmtpFailure("recipient", detail);
  }
  if (/sender|send as|not (owned|allowed|permitted) |5\.7\.60|553|relay access denied|domain.*not verified|not verified/i.test(text)) return new SmtpFailure("sender", detail);
  if (/rate|limit|quota|too many|exceeded|4\.2\.1|452/i.test(text)) return new SmtpFailure("limit", detail);
  return new SmtpFailure("unknown", detail);
};

export type SentMail = { readonly messageId: string };

/** Send one message through a workspace SMTP configuration. Throws SmtpFailure. */
export const sendThroughSmtp = async (c: SmtpConfig, mail: { to: string; subject: string; html: string; text: string; attachments?: Mail.Attachment[] }): Promise<SentMail> => {
  await assertSmtpTarget(c.host, c.port);
  const transport = nodemailer.createTransport(transportOptions(c));
  try {
    const info = await transport.sendMail({
      from: { name: c.fromName, address: c.fromEmail },
      replyTo: c.replyTo || undefined,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    });
    if (info.rejected?.length) throw new SmtpFailure("recipient", String(info.rejected[0]));
    return { messageId: String(info.messageId ?? "") };
  } catch (e) {
    throw classifySmtpError(e);
  } finally {
    transport.close();
  }
};

/** Platform sender (env SMTP_URL / SMTP_FROM), for owner-facing notices only. Null when not configured. */
export const platformSender = (): { url: string; from: string } | null => {
  const url = process.env.SMTP_URL?.trim();
  const from = process.env.SMTP_FROM?.trim();
  return url && from ? { url, from } : null;
};

export const sendThroughPlatform = async (mail: { to: string; subject: string; html: string; text: string; attachments?: Mail.Attachment[] }): Promise<SentMail> => {
  const p = platformSender();
  if (!p) throw new SmtpFailure("connect", "platform sender not configured");
  const transport = nodemailer.createTransport(p.url);
  try {
    const info = await transport.sendMail({ from: p.from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments });
    return { messageId: String(info.messageId ?? "") };
  } catch (e) {
    throw classifySmtpError(e);
  } finally {
    transport.close();
  }
};
