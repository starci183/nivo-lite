import type { AuthOutcome } from "@starci/auth/contracts"
import { authFailure, authOk } from "@starci/auth/client"
import type { StatusCodes } from "@starci/auth/client"
import { apiOrigin } from "@/modules/config"
import { AUTH_ROUTES, safeNext } from "@/modules/routes"
import { parseEmailRequest, parsePassword, parseSignUp } from "./auth.mapper"
import { auth } from "./client"

/** Where a person lands after signing in when no safe destination was asked for: the workspaces home. */
const HOME_PATH = AUTH_ROUTES.workspaces

/** What a sign-in produced: the user and the page to open next. */
export interface SignInResult {
    readonly userId: string
    readonly path: string
}

/** What a password sign-in takes. */
export interface SignInInput {
    readonly email: string
    readonly password: string
    readonly next?: string | undefined
}

/** Signs in with e-mail and password; the back end sets the httpOnly refresh cookie and the access token stays in memory. */
export const signInWithPassword = async (input: SignInInput): Promise<AuthOutcome<SignInResult>> => {
    const parsed = parseEmailRequest({ email: input.email })
    if (parsed === undefined || input.password === "" || input.password.length > 256) {
        return authFailure("invalid", "sign-in-input")
    }
    const outcome = await auth.signIn({ email: parsed.email, password: input.password })
    if (!outcome.success) return outcome
    return authOk({ userId: outcome.data.id, path: safeNext(input.next, window.location.origin) ?? HOME_PATH })
}

/** What a sign-up produced: a mail to confirm first, and the page to open once the link is spent. */
export interface SignUpResult {
    readonly path: string
}

/** Creates a password account. */
export const signUp = async (input: unknown): Promise<AuthOutcome<SignUpResult>> => {
    const parsed = parseSignUp(input)
    if (parsed === undefined) return authFailure("invalid", "sign-up-input")
    const next = safeNext(parsed.next, window.location.origin) ?? "/"
    const sent = await auth.send("signup", { name: parsed.name, email: parsed.email, password: parsed.password })
    return sent.success ? authOk({ path: next }) : sent
}

/** Sends the sign-up confirmation e-mail again. */
export const resendConfirmation = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const sent = await auth.send("resend", { email: parsed.email })
    return sent.success ? authOk(true) : sent
}

/** Sends a password-reset link. A well-formed e-mail always answers ok so accounts cannot be enumerated; only a rate limit is reported. */
export const requestPasswordReset = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const sent = await auth.send("forgot", { email: parsed.email })
    const limited = !sent.success && (sent.error === "IDENTITY_TOO_MANY_ATTEMPTS" || sent.error === "429")
    return !sent.success && limited ? sent : authOk(true)
}

/** What the reset page hands over: the token from the e-mail link and the new password. */
export interface PasswordReset {
    readonly token: string
    readonly password: string
}

const LINK_INVALID: StatusCodes = {
    400: "IDENTITY_RESET_TOKEN_INVALID",
    401: "IDENTITY_RESET_TOKEN_INVALID",
    410: "IDENTITY_RESET_TOKEN_INVALID",
}

/** Sets a new password with the token of the recovery link; the person then signs in again. */
export const updatePassword = async (input: PasswordReset): Promise<AuthOutcome<true>> => {
    const password = parsePassword({ password: input.password })
    if (password === undefined) return authFailure("invalid", "IDENTITY_PASSWORD_INVALID")
    if (input.token === "" || input.token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const sent = await auth.send("reset", { token: input.token, password }, LINK_INVALID)
    if (!sent.success) return sent
    auth.drop()
    return authOk(true)
}

/** Starts a Google sign-in: answers the back end URL for the browser to open; the back end redirects back to `returnTo`. */
export const startOAuth = (next: string | undefined): Promise<AuthOutcome<{ readonly url: string }>> => {
    const origin = window.location.origin
    const returnTo = `${origin}${safeNext(next, origin) ?? HOME_PATH}`
    return Promise.resolve(authOk({ url: `${apiOrigin()}/auth/google?returnTo=${encodeURIComponent(returnTo)}` }))
}

/** Ends the session on the back end (it clears the cookie) and forgets the token here, even when the call fails. */
export const endSession = async (): Promise<AuthOutcome<true>> => {
    await auth.signOut()
    return authOk(true)
}

/** Spends the confirmation link of a new account (the token the mailed link carries). */
export const confirmEmail = async (token: string): Promise<AuthOutcome<true>> => {
    if (token === "" || token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const sent = await auth.send("confirm", { token })
    return sent.success ? authOk(true) : sent
}
