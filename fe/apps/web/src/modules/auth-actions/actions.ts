import type { AuthFailureKind, AuthOutcome } from "@starci/auth/contracts"
import { authFailure, authOk } from "@starci/auth/client"
import { authClient, sendEmailDoor } from "@/modules/auth"
import type { AuthFailure } from "@/modules/auth"
import { apiUrl } from "@/modules/config"
import { APP_ROUTES, safeNext } from "@/modules/routes"
import { parseEmailRequest, parsePassword, parseSignUp } from "./auth.mapper"

/** Where a person lands after signing in when no safe destination was asked for: the front address, which continues into the workspace opened last, else the workspaces page. */
const HOME_PATH = APP_ROUTES.home

const FAILURE_KINDS: ReadonlyArray<AuthFailureKind> = ["refused", "not-found", "invalid", "unavailable"]

/** The failed outcome of a failure the managed auth client answered. */
const failed = <T>(failure: AuthFailure): AuthOutcome<T> =>
    authFailure(FAILURE_KINDS.find((kind) => kind === failure.kind) ?? "unavailable", failure.code)

/** The language of the page the person reads: the mails the back end sends are written in it. */
const pageLanguage = (): "vi" | "en" => (document.documentElement.lang === "en" ? "en" : "vi")

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
    const failure = await authClient.signInWithPassword(parsed.email, input.password)
    if (failure !== undefined) return failed(failure)
    const session = await authClient.session()
    if (session === undefined) return authFailure("unavailable", "sign-in-session")
    return authOk({ userId: session.userId, path: safeNext(input.next, window.location.origin) ?? HOME_PATH })
}

/** What a sign-up produced: a mail to confirm first, and the page to open once the link is spent. */
export interface SignUpResult {
    readonly path: string
}

/** Creates a password account; the sign-up door takes the address and the password, the person sets the name on the account page. */
export const signUp = async (input: unknown): Promise<AuthOutcome<SignUpResult>> => {
    const parsed = parseSignUp(input)
    if (parsed === undefined) return authFailure("invalid", "sign-up-input")
    const next = safeNext(parsed.next, window.location.origin) ?? "/"
    const failure = await sendEmailDoor("signup", {
        email: parsed.email,
        password: parsed.password,
        language: pageLanguage(),
    })
    return failure === undefined ? authOk({ path: next }) : failed(failure)
}

/** Sends the sign-up confirmation e-mail again. */
export const resendConfirmation = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const failure = await sendEmailDoor("resend", { email: parsed.email, language: pageLanguage() })
    return failure === undefined ? authOk(true) : failed(failure)
}

/** Sends a password-reset link. A well-formed e-mail always answers ok so accounts cannot be enumerated; only a rate limit is reported. */
export const requestPasswordReset = async (input: unknown): Promise<AuthOutcome<true>> => {
    const parsed = parseEmailRequest(input)
    if (parsed === undefined) return authFailure("invalid", "email")
    const failure = await sendEmailDoor("forgot", { email: parsed.email, language: pageLanguage() })
    if (failure !== undefined && (failure.code === "IDENTITY_TOO_MANY_ATTEMPTS" || failure.code === "429")) {
        return failed(failure)
    }
    return authOk(true)
}

/** What the reset page hands over: the token from the e-mail link and the new password. */
export interface PasswordReset {
    readonly token: string
    readonly password: string
}

/** Sets a new password with the token of the recovery link; the person then signs in again. */
export const updatePassword = async (input: PasswordReset): Promise<AuthOutcome<true>> => {
    const password = parsePassword({ password: input.password })
    if (password === undefined) return authFailure("invalid", "IDENTITY_PASSWORD_INVALID")
    if (input.token === "" || input.token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const failure = await sendEmailDoor("reset", { token: input.token, password })
    return failure === undefined ? authOk(true) : failed(failure)
}

/** Starts a Google sign-in: answers the back end URL for the browser to open; the back end redirects back to `returnTo`. */
export const startOAuth = (next: string | undefined): Promise<AuthOutcome<{ readonly url: string }>> => {
    const origin = window.location.origin
    const returnTo = `${origin}${safeNext(next, origin) ?? HOME_PATH}`
    return Promise.resolve(authOk({ url: `${apiUrl()}/auth/google?returnTo=${encodeURIComponent(returnTo)}` }))
}

/** Ends the session on the back end (it clears the cookie) and forgets the token here, even when the call fails. */
export const endSession = async (): Promise<AuthOutcome<true>> => {
    await authClient.signOut()
    return authOk(true)
}

/** Spends the confirmation link of a new account (the token the mailed link carries). */
export const confirmEmail = async (token: string): Promise<AuthOutcome<true>> => {
    if (token === "" || token.length > 512) return authFailure("refused", "IDENTITY_RESET_TOKEN_INVALID")
    const failure = await sendEmailDoor("confirm", { token })
    return failure === undefined ? authOk(true) : failed(failure)
}
