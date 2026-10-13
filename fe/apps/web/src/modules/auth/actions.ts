import { APP_ROUTES, AUTH_ROUTES, safeNext } from "@/modules/routes"
import { isRateLimited, parseEmailRequest, parsePassword, parseSignUp } from "./auth.mapper"
import { authClient } from "./client"
import { authFailure, authOk, failureOf } from "./outcome"
import type { AuthOutcome } from "./outcome"

/** Where a person lands after signing in when no safe destination was asked for: the workspaces home. */
const HOME_PATH = AUTH_ROUTES.workspaces

/** The page that turns an e-mail link into a session, then continues to `next`. */
const confirmUrl = (origin: string, next: string): string => `${origin}/auth/confirm?next=${encodeURIComponent(next)}`

/** What a sign-in produced: the user and the page to open next. */
export interface SignInResult {
    readonly userId: string
    readonly path: string
}

/** What a password sign-in takes. */
interface SignInInput {
    readonly email: string
    readonly password: string
    readonly next?: string
}

/** Signs in with e-mail and password; the browser client writes the session cookie. */
export const signInWithPassword = async (input: SignInInput): Promise<AuthOutcome<SignInResult>> => {
    const parsed = parseEmailRequest({ email: input.email })
    if (parsed === undefined || input.password === "" || input.password.length > 256) {
        return authFailure("invalid", "sign-in-input")
    }
    const { data, error } = await authClient().auth.signInWithPassword({
        email: parsed.email,
        password: input.password,
    })
    const failed = failureOf(error)
    if (failed !== undefined) return failed
    if (data.user === null) return authFailure("refused", "user")
    return authOk({ userId: data.user.id, path: safeNext(input.next, window.location.origin) ?? HOME_PATH })
}

/** What a sign-up produced: a session at once (confirmation off) or a mail to confirm first. */
export interface SignUpResult {
    readonly sessionCreated: boolean
    readonly path: string
}

/** Creates a password account; e-mail links come back through /auth/confirm. */
export const signUp = async (input: unknown): Promise<AuthOutcome<SignUpResult>> => {
    const parsed = parseSignUp(input)
    if (parsed === undefined) return authFailure("invalid", "sign-up-input")
    const origin = window.location.origin
    const next = safeNext(parsed.next, origin) ?? "/"
    const { data, error } = await authClient().auth.signUp({
        email: parsed.email,
        password: parsed.password,
        options: { data: { full_name: parsed.name }, emailRedirectTo: confirmUrl(origin, next) },
    })
    const failed = failureOf(error)
    if (failed !== undefined) return failed
    const landing = next === "/" ? HOME_PATH : next
    return authOk({ sessionCreated: data.session !== null, path: data.session === null ? next : landing })
}

/** Sends the sign-up confirmation e-mail again. */
export const resendConfirmation = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const origin = window.location.origin
    const { error } = await authClient().auth.resend({
        type: "signup",
        email: parsed.email,
        options: { emailRedirectTo: confirmUrl(origin, safeNext(parsed.next, origin) ?? "/") },
    })
    return failureOf(error) ?? authOk(true)
}

/** Sends a password-reset link. A well-formed e-mail always answers ok so accounts cannot be enumerated; only a rate limit is reported. */
export const requestPasswordReset = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const { error } = await authClient().auth.resetPasswordForEmail(parsed.email, {
        redirectTo: confirmUrl(window.location.origin, AUTH_ROUTES.resetPassword),
    })
    const failed = failureOf(error)
    return failed !== undefined && isRateLimited(failed.code) ? failed : authOk(true)
}

/** Sets a new password for the person who arrived through the recovery link, then ends every session so they sign in again. */
export const updatePassword = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parsePassword(input)
    if (parsed === undefined) return authFailure("invalid", "weak_password")
    const client = authClient()
    const session = await client.auth.getSession()
    if (session.data.session === null) return authFailure("refused", "otp_expired")
    const { error } = await client.auth.updateUser({ password: parsed })
    const failed = failureOf(error)
    if (failed !== undefined) return failed
    await client.auth.signOut({ scope: "global" })
    return authOk(true)
}

/** Starts a Google sign-in: answers the provider URL for the browser to open; the return trip lands on /auth/callback. */
export const startOAuth = async (next: string | undefined): Promise<AuthOutcome<{ readonly url: string }>> => {
    const origin = window.location.origin
    const safe = safeNext(next, origin)
    const redirectTo = `${origin}${APP_ROUTES.authCallback}${safe === undefined ? "" : `?next=${encodeURIComponent(safe)}`}`
    const { data, error } = await authClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
    })
    const failed = failureOf(error)
    if (failed !== undefined) return failed
    return data.url === null ? authFailure("unavailable", "oauth-url") : authOk({ url: data.url })
}

/** Ends the browser session, including an already-anonymous one. */
export const endSession = async (): Promise<AuthOutcome<true>> => {
    const { error } = await authClient().auth.signOut()
    if (error === null || error.status === 401) return authOk(true)
    return authFailure("unavailable", error.code ?? "sign-out")
}
