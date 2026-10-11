import "server-only";
import { isIP } from "node:net";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { assertPublicHost, type Connector, type RecordInput } from "../data-hub";

/** Email over IMAP, read only: new messages of the chosen folders become hub messages (entity `message`). */

export type ImapSecurity = "tls" | "starttls";
/** The encrypted credential of one mailbox. */
export type ImapCredential = { readonly host: string; readonly port: number; readonly secure: boolean; readonly user: string; readonly password: string };
/** The non-secret settings, kept in public_meta as ONE JSON string under `config`. */
export type ImapConfig = { readonly folders: ReadonlyArray<string>; readonly sinceDays: number };

export const SINCE_CHOICES: ReadonlyArray<number> = [7, 30, 90];
export const MAX_NEW_PER_FOLDER = 200;
export const MAX_TEXT = 20 * 1024;
const MAX_SOURCE = 2_000_000;
const CONNECT_TIMEOUT = 10_000;

export const parseCredential = (raw: string): ImapCredential => {
  try {
    const c = JSON.parse(raw) as Partial<ImapCredential>;
    if (typeof c.host === "string" && typeof c.user === "string" && typeof c.password === "string" && typeof c.port === "number") {
      return { host: c.host, port: c.port, secure: c.secure !== false, user: c.user, password: c.password };
    }
  } catch { /* falls through */ }
  throw new Error("Chưa có thông tin đăng nhập hộp thư. Mở kết nối và nhập lại.");
};

export const parseConfig = (meta: Readonly<Record<string, string>>): ImapConfig => {
  try {
    const c = JSON.parse(meta.config ?? "{}") as Partial<ImapConfig>;
    const folders = Array.isArray(c.folders) ? c.folders.filter((f): f is string => typeof f === "string" && f.length > 0 && f.length <= 200).slice(0, 20) : [];
    const sinceDays = typeof c.sinceDays === "number" && SINCE_CHOICES.includes(c.sinceDays) ? c.sinceDays : 30;
    return { folders: folders.length ? folders : ["INBOX"], sinceDays };
  } catch {
    return { folders: ["INBOX"], sinceDays: 30 };
  }
};

type ErrLike = { code?: string; authenticationFailed?: boolean; responseText?: string; response?: string; message?: string };

/** A plain-language message for whatever the IMAP library threw. */
export const friendlyImapError = (e: unknown): string => {
  if (e instanceof Error && /[ạảãàáâấầẩẫậắằẳẵặđêếềểễệôốồổỗộơớờởỡợưứừửữựíìỉĩịúùủũụýỳỷỹỵ]/i.test(e.message)) return e.message;
  const x = (e ?? {}) as ErrLike;
  const text = `${x.responseText ?? ""} ${x.response ?? ""} ${x.message ?? ""}`;
  if (x.authenticationFailed || /AUTHENTICATIONFAILED|invalid credentials|authentication failed|LOGIN failed|Invalid login/i.test(text)) {
    return /application-specific|app password|web login required|ALERT/i.test(text)
      ? "Hộp thư yêu cầu mật khẩu ứng dụng. Tạo mật khẩu ứng dụng trong cài đặt bảo mật của tài khoản rồi nhập lại."
      : "Sai mật khẩu ứng dụng hoặc tên đăng nhập.";
  }
  if (/IMAP.*(disabled|not enabled)|not allowed|access.*disabled|IMAP access/i.test(text)) return "Máy chủ không cho đăng nhập IMAP: bật IMAP trong cài đặt hộp thư.";
  switch (x.code) {
    case "ENOTFOUND": return "Không tìm thấy máy chủ thư. Kiểm tra lại địa chỉ máy chủ.";
    case "ECONNREFUSED": return "Máy chủ thư từ chối kết nối. Kiểm tra lại cổng và kiểu bảo mật.";
    case "CONNECT_TIMEOUT": case "GREETING_TIMEOUT": case "ETIMEDOUT": case "ETIMEOUT": return "Máy chủ thư không phản hồi trong 10 giây.";
    case "ClosedAfterConnectTLS": case "ECONNRESET": return "Không thiết lập được kết nối bảo mật. Thử cổng 993 (TLS) hoặc 143 (STARTTLS).";
    case "ERR_TLS_CERT_ALTNAME_INVALID": case "CERT_HAS_EXPIRED": case "DEPTH_ZERO_SELF_SIGNED_CERT": case "UNABLE_TO_VERIFY_LEAF_SIGNATURE": return "Chứng chỉ bảo mật của máy chủ thư không hợp lệ.";
    case "STARTTLS_INJECTION": case "UPGRADE_TIMEOUT": return "Không nâng được kết nối lên STARTTLS.";
    default: break;
  }
  if (/mailbox.*(not exist|doesn't exist)|NONEXISTENT|Unknown Mailbox/i.test(text)) return "Không tìm thấy thư mục này trong hộp thư.";
  return "Không đọc được hộp thư. Kiểm tra lại thông tin kết nối rồi thử lại.";
};

/** Connects to the resolved public address (the name is kept only as the TLS servername). Read-only use. */
export const openImap = async (cred: ImapCredential): Promise<ImapFlow> => {
  const { address } = await assertPublicHost(cred.host);
  const host = cred.host.trim().replace(/^\[|\]$/g, "");
  const dev = process.env.DATA_ALLOW_PRIVATE_HOSTS === "1";
  const named = isIP(host) ? {} : { servername: host };
  const client = new ImapFlow({
    host: address, port: cred.port, secure: cred.secure, ...(cred.secure ? {} : { doSTARTTLS: true }),
    ...named,
    tls: { ...named, ...(dev ? { rejectUnauthorized: false } : {}) },
    auth: { user: cred.user, pass: cred.password }, logger: false, disableAutoIdle: true, disableCompression: true,
    connectionTimeout: CONNECT_TIMEOUT, greetingTimeout: CONNECT_TIMEOUT, socketTimeout: 60_000,
  });
  client.on("error", () => { /* surfaced by the awaited call; this only stops an unhandled event */ });
  try {
    await client.connect();
  } catch (e) {
    client.close();
    throw new Error(friendlyImapError(e));
  }
  return client;
};

/** Logs out; never throws. */
export const closeImap = async (client: ImapFlow): Promise<void> => {
  try { await client.logout(); } catch { client.close(); }
};

/** Opens a connection, lists the selectable folder paths, logs out. */
export const listFolders = async (cred: ImapCredential): Promise<string[]> => {
  const client = await openImap(cred);
  try {
    const list = await client.list();
    return list.filter((m) => !m.flags.has("\\Noselect") && !m.flags.has("\\NonExistent")).map((m) => m.path).sort((a, b) => (a === "INBOX" ? -1 : b === "INBOX" ? 1 : a.localeCompare(b)));
  } catch (e) {
    throw new Error(friendlyImapError(e));
  } finally {
    await closeImap(client);
  }
};

const addrs = (a: AddressObject | AddressObject[] | undefined) => (a ? (Array.isArray(a) ? a.flatMap((x) => x.value) : a.value) : []).map((v) => ({ name: v.name || null, address: v.address || null }));
const stripHtml = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** One parsed email as a hub row: externalId `<folder>:<uidvalidity>:<uid>`, 20 KB of text, attachments as name/type/size only. */
export const messageToRecord = (folder: string, uidValidity: string, uid: number, mail: ParsedMail, fallbackDate?: Date | string | null): RecordInput => {
  const body = (mail.text ?? (typeof mail.html === "string" ? stripHtml(mail.html) : "")).trim();
  const date = mail.date ?? (fallbackDate ? new Date(fallbackDate) : null);
  return {
    externalId: `${folder}:${uidValidity}:${uid}`,
    title: mail.subject ?? "",
    occurredAt: date && !Number.isNaN(date.getTime()) ? date : null,
    data: {
      folder, uid,
      from: addrs(mail.from), to: addrs(mail.to), cc: addrs(mail.cc),
      subject: mail.subject ?? "",
      text: body.slice(0, MAX_TEXT), truncated: body.length > MAX_TEXT,
      attachments: mail.attachments.map((a) => ({ name: a.filename ?? null, type: a.contentType, size: a.size })),
      messageId: mail.messageId ?? null,
      inReplyTo: mail.inReplyTo ?? null,
    },
  };
};

const cursorKey = (folder: string) => `cursor:${folder}`;
const parseCursor = (v: string | undefined) => {
  const m = /^(\d+):(\d+)$/.exec(v ?? "");
  return m ? { validity: m[1] as string, uid: Number(m[2]) } : null;
};

export const connector: Connector = {
  sync: async (ctx) => {
    const cred = parseCredential(ctx.credential);
    const cfg = parseConfig(ctx.connection.meta);
    const client = await openImap(cred);
    const meta: Record<string, string> = {};
    let total = 0;
    const notes: string[] = [];
    try {
      for (const folder of cfg.folders) {
        if (ctx.signal.aborted) { notes.push("Dừng sớm do hết thời gian, lần sau sẽ tiếp tục."); break; }
        let lock;
        try {
          lock = await client.getMailboxLock(folder, { readOnly: true });
        } catch (e) {
          notes.push(`${folder}: ${friendlyImapError(e)}`);
          continue;
        }
        try {
          const box = client.mailbox;
          if (!box) continue;
          const validity = String(box.uidValidity);
          const prev = parseCursor(ctx.connection.meta[cursorKey(folder)]);
          const known = prev && prev.validity === validity ? prev.uid : 0;
          let uids: number[];
          if (known > 0) {
            const found = await client.search({ uid: `${known + 1}:*` }, { uid: true });
            uids = (found || []).filter((u) => u > known);
          } else {
            const since = new Date(Date.now() - cfg.sinceDays * 86_400_000);
            uids = (await client.search({ since }, { uid: true })) || [];
          }
          uids.sort((a, b) => a - b);
          const more = uids.length > MAX_NEW_PER_FOLDER;
          uids = uids.slice(0, MAX_NEW_PER_FOLDER);
          let last = known;
          if (!uids.length) {
            if (known === 0) meta[cursorKey(folder)] = `${validity}:0`;
            continue;
          }
          const rows: RecordInput[] = [];
          for await (const msg of client.fetch(uids.join(","), { uid: true, internalDate: true, source: { maxLength: MAX_SOURCE } }, { uid: true })) {
            if (ctx.signal.aborted) break;
            if (!msg.source) continue;
            try {
              rows.push(messageToRecord(folder, validity, msg.uid, await simpleParser(msg.source), msg.internalDate));
            } catch {
              rows.push({ externalId: `${folder}:${validity}:${msg.uid}`, title: "", occurredAt: msg.internalDate ?? null, data: { folder, uid: msg.uid, subject: "", text: "", unreadable: true, attachments: [] } });
            }
            last = Math.max(last, msg.uid);
          }
          if (rows.length) total += await ctx.upsert("message", rows);
          meta[cursorKey(folder)] = `${validity}:${last}`;
          if (more) notes.push(`${folder}: còn thư mới, sẽ lấy tiếp ở lần sau.`);
        } catch (e) {
          notes.push(`${folder}: ${friendlyImapError(e)}`);
        } finally {
          lock.release();
        }
      }
    } finally {
      await closeImap(client);
    }
    if (total === 0 && notes.length >= cfg.folders.length && notes.every((n) => !n.includes("còn thư mới"))) throw new Error(notes.join(" "));
    return { rows: total, ...(notes.length ? { note: notes.join(" ") } : {}), meta };
  },
};
