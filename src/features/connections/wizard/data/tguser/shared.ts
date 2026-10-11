/**
 * Pure helpers and types of the personal Telegram connector, shared by the server (connector, actions) and the wizard.
 * Nothing here touches the network, a secret or Next.js, so the browser can import it and a script can test it.
 */
import type { RecordInput } from "@/lib/data-hub"

export type ChatKind = "user" | "group" | "channel"
export type PickedChat = { readonly id: string; readonly title: string; readonly kind: ChatKind }
export type ChatChoice = PickedChat & { readonly unread: number }
export type SinceDays = 7 | 30
export type TgConfig = { readonly chats: ReadonlyArray<PickedChat>; readonly sinceDays: SinceDays }

export const MAX_CHATS = 50
export const MAX_PER_CHAT_PER_RUN = 200
export const LOGIN_TTL_MS = 10 * 60_000
export const SCHEDULE_CHOICES: ReadonlyArray<number | null> = [null, 15, 60]
export const REVOKED_MESSAGE = "Phiên Telegram đã bị đăng xuất, hãy kết nối lại"

/* ------------------------------------------------------------------ phone */

/** E.164 from what an owner types: "0912 345 678" and "84912345678" become +84912345678; "+1 415 555 0100" stays. Null when it is not a phone number. */
export const normalizePhone = (raw: string): string | null => {
  let s = raw.trim().replace(/[\s.\-()]/g, "")
  if (!/^\+?\d+$/.test(s)) return null
  if (s.startsWith("00")) s = `+${s.slice(2)}`
  else if (s.startsWith("+")) s = `+${s.slice(1)}`
  else if (s.startsWith("0")) s = `+84${s.slice(1)}`
  else if (s.startsWith("84") && s.length >= 11 && s.length <= 12) s = `+${s}`
  else return null
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null
}

/** Only the last three digits ever leave the server, and only as part of the account label. */
export const maskPhone = (phone: string): string => `…${phone.replace(/\D/g, "").slice(-3)}`

/* ------------------------------------------------------------------ credential (always encrypted at rest) */

export type LoginStage = "code" | "password"
export type LoginState = {
  readonly stage: LoginStage
  readonly phone: string
  readonly phoneCodeHash: string
  /** The temporary StringSession of the half finished login. */
  readonly session: string
  readonly startedAt: number
}
export type TgCredential = { readonly session?: string; readonly login?: LoginState }

export const parseCredential = (raw: string | null | undefined): TgCredential => {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    const l = v.login as Record<string, unknown> | undefined
    const login: LoginState | undefined = l && typeof l.session === "string" && typeof l.phone === "string" && typeof l.phoneCodeHash === "string"
      ? { stage: l.stage === "password" ? "password" : "code", phone: l.phone, phoneCodeHash: l.phoneCodeHash, session: l.session, startedAt: Number(l.startedAt) || 0 }
      : undefined
    return { ...(typeof v.session === "string" && v.session ? { session: v.session } : {}), ...(login ? { login } : {}) }
  } catch {
    return {}
  }
}

export const loginExpired = (login: LoginState, now = Date.now()): boolean => now - login.startedAt > LOGIN_TTL_MS

/* ------------------------------------------------------------------ config (public_meta.config, one JSON string) */

const KINDS: ReadonlyArray<string> = ["user", "group", "channel"]

export const parseConfig = (raw: string | null | undefined): TgConfig | null => {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { chats?: unknown; sinceDays?: unknown }
    if (!Array.isArray(v.chats)) return null
    const seen = new Set<string>()
    const chats: Array<PickedChat> = []
    for (const c of v.chats as Array<Record<string, unknown>>) {
      const id = typeof c?.id === "string" ? c.id : ""
      if (!/^-?\d{1,20}$/.test(id) || seen.has(id)) continue
      seen.add(id)
      chats.push({ id, title: typeof c.title === "string" ? c.title.slice(0, 120) : id, kind: KINDS.includes(String(c.kind)) ? (c.kind as ChatKind) : "group" })
      if (chats.length >= MAX_CHATS) break
    }
    return { chats, sinceDays: v.sinceDays === 30 ? 30 : 7 }
  } catch {
    return null
  }
}

export const serializeConfig = (cfg: TgConfig): string =>
  JSON.stringify({ chats: cfg.chats.slice(0, MAX_CHATS).map((c) => ({ id: c.id, title: c.title.slice(0, 120), kind: c.kind })), sinceDays: cfg.sinceDays })

/** The number of chats, the owner's wording. */
export const summaryOf = (n: number): string => `${n} cuộc trò chuyện`

export const accountLabel = (name: string, username: string | undefined, phone: string): string =>
  `${name.trim() || "Telegram"}${username ? ` (@${username})` : ""} ${maskPhone(phone)}`

/* ------------------------------------------------------------------ sync */

export const cursorKey = (chatId: string): string => `cursor:${chatId}`

/** The last stored message id of one chat (0 when none yet). */
export const readCursor = (meta: Readonly<Record<string, string>>, chatId: string): number => {
  const n = Number(meta[cursorKey(chatId)])
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Unix seconds of the first sync window. */
export const sinceUnix = (sinceDays: number, nowMs = Date.now()): number => Math.floor((nowMs - sinceDays * 86_400_000) / 1000)

export type RawMessage = {
  readonly id: number
  /** Unix seconds. */
  readonly date: number
  readonly text: string
  readonly senderName: string
  readonly replyToId: number | null
  readonly hasMedia: boolean
}

export const mapMessage = (chat: PickedChat, m: RawMessage): RecordInput => {
  const text = m.text.slice(0, 4000)
  return {
    externalId: `${chat.id}:${m.id}`,
    title: text.slice(0, 120) || (m.hasMedia ? "(tệp đính kèm)" : ""),
    occurredAt: new Date(m.date * 1000),
    data: { chatId: chat.id, chatTitle: chat.title, senderName: m.senderName, text, replyToId: m.replyToId, hasMedia: m.hasMedia },
  }
}

/** Telegram says the session is gone (signed out in Devices, account deleted or banned). */
const REVOKED = new Set(["AUTH_KEY_UNREGISTERED", "SESSION_REVOKED", "SESSION_EXPIRED", "USER_DEACTIVATED", "USER_DEACTIVATED_BAN", "AUTH_KEY_INVALID", "AUTH_KEY_DUPLICATED"])
export const errorCode = (e: unknown): string => {
  const x = e as { errorMessage?: unknown; message?: unknown } | null
  return typeof x?.errorMessage === "string" ? x.errorMessage : typeof x?.message === "string" ? x.message : ""
}
export const isRevokedError = (e: unknown): boolean => REVOKED.has(errorCode(e))
