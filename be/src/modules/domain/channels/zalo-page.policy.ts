import type { ZaloFollowEventRow, ZaloInboxFactsRow } from "./channels.port"
import { sepayQrUrlOf } from "./qr-image.policy"
import type {
    ZaloCheckRow,
    ZaloPageEvent,
    ZaloRecipient,
    ZaloSendBlock,
    ZaloTokenState,
    ZaloAccessView,
} from "./zalo-page.contracts"
import type { LastReplyRow, MessageEventRow, RecipientRow } from "./persistence/zalo-page.rows"
import type { ZaloSecret } from "./channels.contracts"

const MINUTE_MS = 60_000
const EXCERPT = 120
const MASK = "\u2022".repeat(4)
const ELLIPSIS = "\u2026"

/** A secret shown as dots and its last four characters, or null when none is saved. */
export const maskTail = (secret: string): string | null => {
    if (secret.length === 0) return null
    return secret.length <= 4 ? MASK : `${MASK}${secret.slice(-4)}`
}

/** The Zalo user id of a conversation's external id; an archived conversation carries `<id>:<timestamp>`. */
export const zaloUserIdOf = (externalId: string): string => {
    const cut = externalId.indexOf(":")
    return cut < 0 ? externalId : externalId.slice(0, cut)
}

const refreshLive = (secret: ZaloSecret, nowMs: number): boolean => {
    if (secret.renewalToken === undefined || secret.renewalToken === "") return false
    if (secret.refreshExpiresAt === undefined) return true
    const ends = Date.parse(secret.refreshExpiresAt)
    return Number.isNaN(ends) || ends > nowMs
}

const stateOf = (alive: boolean, canRefresh: boolean): ZaloTokenState => {
    if (alive) return "valid"
    return canRefresh ? "renewable" : "expired"
}

/**
 * Where the access token stands. An access token lives about an hour and is renewed on use, so an ended one with a live refresh token is only
 * `renewable`; it is `expired` when nothing can renew it (no refresh token, an ended one, or Zalo refused the refresh and the connection fails).
 */
export const tokenViewOf = (
    secret: ZaloSecret,
    expiresAtMs: number | null,
    status: string,
    nowMs: number,
): ZaloAccessView => {
    const canRefresh = refreshLive(secret, nowMs) && status !== "error"
    const hasToken = secret.accessToken !== undefined && secret.accessToken !== ""
    if (!hasToken && !canRefresh) return { state: "none", expiresAt: null, expiredMinutesAgo: null, canRefresh }
    const alive = expiresAtMs !== null && expiresAtMs > nowMs
    const state = stateOf(alive, canRefresh)
    return {
        state,
        expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
        expiredMinutesAgo:
            !alive && expiresAtMs !== null ? Math.max(0, Math.floor((nowMs - expiresAtMs) / MINUTE_MS)) : null,
        canRefresh,
    }
}

/** True when the token is something a send can use now or after an automatic renewal. */
export const tokenUsable = (token: ZaloAccessView): boolean => token.state === "valid" || token.state === "renewable"

/** Why the test send is closed, or null when it is open. */
export const sendBlockOf = (token: ZaloAccessView, recipients: number): ZaloSendBlock | null => {
    if (token.state === "none") return "not_authorized"
    if (!tokenUsable(token)) return "token_expired"
    return recipients === 0 ? "no_recipient" : null
}

/** The facts the check list is judged from. */
export interface ZaloCheckFacts {
    /** The app id and secret are saved. */
    readonly appSaved: boolean
    /** The OA Secret Key is saved. */
    readonly oaSecretSaved: boolean
    /** The access token. */
    readonly token: ZaloAccessView
    /** What the inbox holds. */
    readonly inbox: ZaloInboxFactsRow | null
    /** The latest reply the agent tried to send. */
    readonly lastReply: LastReplyRow | null
}

const tokenRow = (token: ZaloAccessView): ZaloCheckRow => {
    const base = { key: "token", at: token.expiresAt, names: [] } as const
    if (token.state === "valid") return { ...base, state: "ok", code: "token_valid" }
    if (token.state === "renewable") return { ...base, state: "ok", code: "token_renewable" }
    if (token.state === "none") return { ...base, state: "fail", code: "token_none" }
    return { ...base, state: "fail", code: "token_expired" }
}

const webhookRow = (facts: ZaloCheckFacts): ZaloCheckRow => {
    const base = { key: "webhook", at: facts.inbox?.last_at ?? null } as const
    if (!facts.oaSecretSaved) return { ...base, at: null, state: "fail", code: "webhook_no_secret", names: [] }
    const seen = [
        facts.inbox?.has_text === true ? "user_send_text" : "",
        facts.inbox?.has_follow === true ? "follow" : "",
    ]
    const names = seen.filter((name) => name !== "")
    if (facts.inbox?.last_at === null || facts.inbox === null)
        return { ...base, state: "warn", code: "webhook_silent", names }
    return { ...base, state: "ok", code: "webhook_receiving", names }
}

const permissionsRow = (lastReply: LastReplyRow | null): ZaloCheckRow => {
    const base = { key: "permissions", at: null } as const
    if (lastReply === null) return { ...base, state: "warn", code: "permissions_unknown", names: [] }
    if (lastReply.delivery_status === "sent") return { ...base, state: "ok", code: "permissions_send_ok", names: [] }
    if (lastReply.delivery_error === "zalo_not_permitted") {
        return { ...base, state: "fail", code: "permissions_send_denied", names: ["message_send"] }
    }
    return { ...base, state: "warn", code: "permissions_unknown", names: [] }
}

/** The four rows of the check list. Zalo does not list the permissions granted, so that row is judged from the last real send. */
export const checksOf = (facts: ZaloCheckFacts): ReadonlyArray<ZaloCheckRow> => [
    {
        key: "app",
        state: facts.appSaved ? "ok" : "fail",
        code: facts.appSaved ? "app_saved" : "app_missing",
        at: null,
        names: [],
    },
    tokenRow(facts.token),
    webhookRow(facts),
    permissionsRow(facts.lastReply),
]

/** The followers who wrote lately, one per Zalo user, newest first. */
export const recipientsOf = (rows: ReadonlyArray<RecipientRow>): ReadonlyArray<ZaloRecipient> => {
    const byUser = new Map<string, ZaloRecipient>()
    for (const row of rows) {
        if (row.external_id === null) continue
        const userId = zaloUserIdOf(row.external_id)
        if (userId === "" || byUser.has(userId)) continue
        byUser.set(userId, {
            userId,
            name: row.visitor_name ?? "",
            lastMessageAt: new Date(row.last_at).toISOString(),
        })
    }
    return [...byUser.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

const excerpt = (text: string): string => (text.length > EXCERPT ? `${text.slice(0, EXCERPT)}${ELLIPSIS}` : text)

/** A failure the delivery path stored as a generic error reads as an expired token when the token cannot work now. */
const reasonOf = (stored: string | null, token: ZaloAccessView): string => {
    const failure = stored ?? "delivery_failed"
    if (!tokenUsable(token) && (failure === "zalo_error" || failure === "zalo_token")) return "token_expired"
    return failure
}

const messageEvent = (row: MessageEventRow, token: ZaloAccessView): ZaloPageEvent => {
    const at = new Date(row.created_at).toISOString()
    const who = row.visitor_name ?? ""
    if (row.role === "user") {
        return {
            id: row.id,
            kind: "user_send_text",
            outcome: "received",
            at,
            who,
            text: excerpt(row.body),
            reason: null,
        }
    }
    const kind = sepayQrUrlOf(row.body) === null ? "agent_reply" : "renewal_qr"
    const failed = row.delivery_status === "failed"
    return {
        id: row.id,
        kind,
        outcome: failed ? "not_sent" : "sent",
        at,
        who,
        text: kind === "renewal_qr" ? "" : excerpt(row.body),
        reason: failed ? reasonOf(row.delivery_error, token) : null,
    }
}

/** The live panel: customer texts, follows, agent replies and renewal QRs, newest first. */
export const eventsOf = (
    messages: ReadonlyArray<MessageEventRow>,
    follows: ReadonlyArray<ZaloFollowEventRow>,
    token: ZaloAccessView,
): ReadonlyArray<ZaloPageEvent> => {
    const lines: Array<ZaloPageEvent> = [
        ...messages.map((row) => messageEvent(row, token)),
        ...follows.map((row): ZaloPageEvent => ({
            id: row.id,
            kind: "follow",
            outcome: "received",
            at: new Date(row.received_at).toISOString(),
            who: "",
            text: "",
            reason: null,
        })),
    ]
    return lines.toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, 40)
}
