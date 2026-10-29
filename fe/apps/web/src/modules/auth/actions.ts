import type { GraphQLResponse } from "@/modules/types"
import { apiOrigin } from "@/modules/config"
import { AUTH_ROUTES, safeNext } from "@/modules/routes"
import { parseEmailRequest, parsePassword, parseSignUp } from "./auth.mapper"
import { confirmDoor, forgotDoor, loginDoor, logoutDoor, resendDoor, resetDoor, signupDoor } from "./auth-door"
import type { AuthDoorAnswer } from "./auth-door"
import { authFailure, authOk, failureOfStatus } from "./outcome"
import type { StatusCodes } from "./outcome"
import { clearSession, isGrant, storeGrant } from "./session"

/** Where a person lands after signing in when no safe destination was asked for: the workspaces home. */
const HOME_PATH = AUTH_ROUTES.workspaces

/** One call of the back end auth doors: the door to knock on and the body it takes. */
interface DoorCall {
    readonly door: (body: object) => Promise<AuthDoorAnswer>
    readonly body?: object
    readonly fallbacks?: StatusCodes
}

/** What a door answered: the JSON body when it had one. */
interface DoorAnswer {
    readonly ok: boolean
    readonly status: number
    readonly body: unknown
}

const fieldOf = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null ? Object.entries(value).find(([name]) => name === key)?.[1] : undefined

const answerOf = async (call: DoorCall): Promise<DoorAnswer | undefined> => {
    try {
        const answer = await call.door(call.body ?? {})
        return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, body: answer.body }
    } catch {
        return undefined
    }
}

/** What a sent call came to: a failed outcome, or the JSON body of the answer. */
type Sent<T> = { readonly failed: GraphQLResponse<T> } | { readonly failed?: undefined; readonly body: unknown }

const send = async <T>(call: DoorCall): Promise<Sent<T>> => {
    const answer = await answerOf(call)
    if (answer === undefined) return { failed: authFailure("unavailable", "transport") }
    if (answer.ok) return { body: answer.body }
    const code = fieldOf(answer.body, "code")
    return { failed: failureOfStatus(answer.status, typeof code === "string" ? code : undefined, call.fallbacks) }
}

/** What a sign-in produced: the user and the page to open next. */
export interface SignInResult {
    readonly userId: string
    readonly path: string
}

/** What a password sign-in takes. */
interface SignInInput {
    readonly email: string
    readonly password: string
    readonly next?: string | undefined
}

const userIdOfBody = (body: unknown): string => {
    const id = fieldOf(fieldOf(body, "user"), "id")
    return typeof id === "string" ? id : ""
}

/** Signs in with e-mail and password; the back end sets the httpOnly refresh cookie and the access token stays in memory. */
export const signInWithPassword = async (input: SignInInput): Promise<GraphQLResponse<SignInResult>> => {
    const parsed = parseEmailRequest({ email: input.email })
    if (parsed === undefined || input.password === "" || input.password.length > 256) {
        return authFailure("invalid", "sign-in-input")
    }
    const sent = await send<SignInResult>({
        door: loginDoor,
        body: { email: parsed.email, password: input.password },
        fallbacks: { 401: "IDENTITY_INVALID_CREDENTIALS" },
    })
    if (sent.failed !== undefined) return sent.failed
    if (!isGrant(sent.body)) return authFailure("refused", "user")
    storeGrant(sent.body, "SIGNED_IN")
    return authOk({
        userId: userIdOfBody(sent.body),
        path: safeNext(input.next, window.location.origin) ?? HOME_PATH,
    })
}

/** What a sign-up produced: a session at once (confirmation off) or a mail to confirm first. */
export interface SignUpResult {
    readonly sessionCreated: boolean
    readonly path: string
}

/** Creates a password account. */
export const signUp = async (input: unknown): Promise<GraphQLResponse<SignUpResult>> => {
    const parsed = parseSignUp(input)
    if (parsed === undefined) return authFailure("invalid", "sign-up-input")
    const next = safeNext(parsed.next, window.location.origin) ?? "/"
    const sent = await send<SignUpResult>({
        door: signupDoor,
        body: { name: parsed.name, email: parsed.email, password: parsed.password },
    })
    if (sent.failed !== undefined) return sent.failed
    if (!isGrant(sent.body)) return authOk({ sessionCreated: false, path: next })
    storeGrant(sent.body, "SIGNED_IN")
    return authOk({ sessionCreated: true, path: next === "/" ? HOME_PATH : next })
}

/** Sends the sign-up confirmation e-mail again. */
export const resendConfirmation = async (input: unknown): Promise<GraphQLResponse<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const sent = await send<true>({ door: resendDoor, body: { email: parsed.email } })
    return sent.failed ?? authOk(true)
}

/** Sends a password-reset link. A well-formed e-mail always answers ok so accounts cannot be enumerated; only a rate limit is reported. */
export const requestPasswordReset = async (input: unknown): Promise<GraphQLResponse<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const sent = await send<true>({ door: forgotDoor, body: { email: parsed.email } })
    const limited = sent.failed?.error === "IDENTITY_TOO_MANY_ATTEMPTS" || sent.failed?.error === "429"
    return sent.failed !== undefined && limited ? sent.failed : authOk(true)
}

/** What the reset page hands over: the token from the e-mail link and the new password. */
export interface PasswordReset {
    readonly token: string
    readonly password: string
}

/** Sets a new password with the token of the recovery link; the person then signs in again. */
export const updatePassword = async (input: PasswordReset): Promise<GraphQLResponse<true>> => {
    const password = parsePassword({ password: input.password })
    if (password === undefined) return authFailure("invalid", "IDENTITY_PASSWORD_INVALID")
    if (input.token === "" || input.token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const sent = await send<true>({
        door: resetDoor,
        body: { token: input.token, password },
        fallbacks: {
            400: "IDENTITY_RESET_TOKEN_INVALID",
            401: "IDENTITY_RESET_TOKEN_INVALID",
            410: "IDENTITY_RESET_TOKEN_INVALID",
        },
    })
    if (sent.failed !== undefined) return sent.failed
    clearSession()
    return authOk(true)
}

/** Starts a Google sign-in: answers the back end URL for the browser to open; the back end redirects back to `returnTo`. */
export const startOAuth = (next: string | undefined): Promise<GraphQLResponse<{ readonly url: string }>> => {
    const origin = window.location.origin
    const returnTo = `${origin}${safeNext(next, origin) ?? HOME_PATH}`
    return Promise.resolve(authOk({ url: `${apiOrigin()}/auth/google?returnTo=${encodeURIComponent(returnTo)}` }))
}

/** Ends the session on the back end (it clears the cookie) and forgets the token here, even when the call fails. */
export const endSession = async (): Promise<GraphQLResponse<true>> => {
    const answer = await answerOf({ door: logoutDoor })
    clearSession()
    if (answer === undefined || answer.ok || answer.status === 401) return authOk(true)
    return authFailure("unavailable", "sign-out")
}

/** Spends the confirmation link of a new account (the token the mailed link carries). */
export const confirmEmail = async (token: string): Promise<GraphQLResponse<true>> => {
    if (token === "" || token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const sent = await send<true>({ door: confirmDoor, body: { token } })
    return sent.failed ?? authOk(true)
}
