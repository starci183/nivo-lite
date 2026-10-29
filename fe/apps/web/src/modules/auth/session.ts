import type { GraphQLResponse } from "@/modules/types"
import { refreshDoor } from "./auth-door"
import { authFailure, authOk, failureOfStatus } from "./outcome"
import { dropToken, heldToken, holdToken, isTokenFresh, markAnnounced, shareRefresh, wasAnnounced } from "./token-store"

/** What the auth doors answer on sign-in and refresh. */
export interface TokenGrant {
    readonly accessToken: string
    readonly expiresIn: number
}

/** The event a listener hears, named like the ones the console already reacts to. */
type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED"
type Listener = (event: string, userId: string | null) => void

/** Refresh this long before the token really expires, so a request never carries a dying one. */
const SKEW_MS = 15_000

const listeners = new Set<Listener>()

const claimsOf = (token: string): { readonly sub?: unknown; readonly email?: unknown } => {
    const payload = token.split(".")[1]
    if (payload === undefined) return {}
    try {
        const json = atob(payload.replaceAll("-", "+").replaceAll("_", "/"))
        const parsed: unknown = JSON.parse(json)
        return typeof parsed === "object" && parsed !== null ? parsed : {}
    } catch {
        return {}
    }
}

const userIdOf = (token: string | undefined): string | null => {
    const sub = token === undefined ? undefined : claimsOf(token).sub
    return typeof sub === "string" ? sub : null
}

const notify = (event: AuthEvent): void => {
    const userId = userIdOf(heldToken())
    for (const listener of listeners) listener(event, userId)
}

/** Keeps a granted token in memory and tells the listeners who is signed in now. */
export const storeGrant = (grant: TokenGrant, event: AuthEvent): void => {
    holdToken(grant.accessToken, grant.expiresIn)
    notify(event)
}

/** Forgets the token (sign-out or a refresh the back end refused). */
export const clearSession = (): void => {
    if (dropToken()) notify("SIGNED_OUT")
}

/** Whether an auth door answer is a token grant (an access token and its lifetime in seconds). */
export const isGrant = (value: unknown): value is TokenGrant =>
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    "expiresIn" in value &&
    typeof value.expiresIn === "number"

/** The event a successful refresh announces: the first answer, a return from signed-out, or a plain token renewal. */
const refreshEvent = (): AuthEvent => {
    if (!wasAnnounced()) return "INITIAL_SESSION"
    return heldToken() === undefined ? "SIGNED_IN" : "TOKEN_REFRESHED"
}

const requestRefresh = async (): Promise<GraphQLResponse<string>> => {
    try {
        const answer = await refreshDoor()
        if (answer.status < 200 || answer.status >= 300) {
            if (answer.status === 401 || answer.status === 403) clearSession()
            return failureOfStatus(answer.status, undefined)
        }
        if (!isGrant(answer.body)) return authFailure("unavailable", "grant")
        storeGrant(answer.body, refreshEvent())
        return authOk(answer.body.accessToken)
    } catch {
        return authFailure("unavailable", "transport")
    }
}

/** Refreshes through the httpOnly cookie and answers the new access token (`undefined` when it cannot be refreshed). Overlapping calls share one refresh. */
export const renewSessionToken = async (): Promise<string | undefined> => {
    const outcome = await shareRefresh(requestRefresh)
    return outcome.success ? outcome.data : undefined
}

/** The access token of the current session, refreshed when missing or about to expire; `undefined` when signed out. */
export const sessionAccessToken = async (): Promise<string | undefined> =>
    isTokenFresh(SKEW_MS) ? heldToken() : renewSessionToken()

/** The signed-in person (id and e-mail, read from the access token), or `null` when signed out. */
export const sessionUser = async (): Promise<{ readonly id: string; readonly email: string } | null> => {
    const token = await sessionAccessToken()
    if (token === undefined) return null
    const { sub, email } = claimsOf(token)
    return typeof sub === "string" ? { id: sub, email: typeof email === "string" ? email : "" } : null
}

/** Calls `onChange` with the event and the id of the person the session belongs to (`null` when signed out) on every sign-in, sign-out and token refresh, and answers the function that stops listening. The first answer comes from a refresh. */
export const subscribeToAuthChange = (onChange: Listener): (() => void) => {
    listeners.add(onChange)
    if (wasAnnounced()) {
        onChange("INITIAL_SESSION", userIdOf(heldToken()))
    } else {
        void renewSessionToken().then(() => {
            if (!wasAnnounced()) markAnnounced()
            if (heldToken() === undefined) onChange("INITIAL_SESSION", null)
        })
    }
    return () => {
        listeners.delete(onChange)
    }
}
