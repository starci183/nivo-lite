import type { ZaloInboxFactsRow, ZaloWriter } from "./channels.port"
import type { ZaloCheckRow, ZaloRecipient, ZaloSendBlock, ZaloTokenState, ZaloAccessView } from "./zalo-page.contracts"
import type { ZaloSecret } from "./channels.contracts"

const MINUTE_MS = 60_000
const MASK = "\u2022".repeat(4)

/** A secret shown as dots and its last four characters, or null when none is saved. */
export const maskTail = (secret: string): string | null => {
    if (secret.length === 0) return null
    return secret.length <= 4 ? MASK : `${MASK}${secret.slice(-4)}`
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

/** The three rows of the check list. */
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
]

/** The people who wrote lately, one per Zalo user, newest first. */
export const recipientsOf = (writers: ReadonlyArray<ZaloWriter>): ReadonlyArray<ZaloRecipient> => {
    const byUser = new Map<string, ZaloRecipient>()
    for (const writer of writers) {
        if (writer.userId === "" || byUser.has(writer.userId)) continue
        byUser.set(writer.userId, { userId: writer.userId, name: writer.name, lastMessageAt: new Date(writer.lastAt).toISOString() })
    }
    return [...byUser.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}
