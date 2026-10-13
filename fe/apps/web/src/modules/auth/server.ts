import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"
import { sessionCookieOptions, supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { authFailure, authOk, failureOf } from "./outcome"
import type { AuthOutcome } from "./outcome"

/**
 * The cookies of one server request, as the caller hands them in (`await cookies()` of a route handler or a server component).
 * This module never imports `next/headers` itself: its entry is shared with browser code.
 */
interface SessionCookieJar {
    readonly getAll: () => ReadonlyArray<{ readonly name: string; readonly value: string }>
    readonly set: (name: string, value: string, options: CookieOptions) => unknown
}

/** A cookie write a server component cannot make (only route handlers and the proxy may); the proxy refreshes those. */
const isReadOnlyCookieStore = (cause: unknown): boolean =>
    cause instanceof Error && cause.message.includes("Cookies can only be modified")

/** The cookie-backed server Auth client over the cookies of the current request. */
const cookieAuthClient = (jar: SessionCookieJar): SupabaseClient =>
    createServerClient(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => [...jar.getAll()],
            setAll: (changes) => {
                try {
                    for (const change of changes) {
                        jar.set(change.name, change.value, { ...change.options, ...sessionCookieOptions })
                    }
                } catch (cause) {
                    if (!isReadOnlyCookieStore(cause)) throw cause
                }
            },
        },
    })

/** The proxy Auth client: every refreshed cookie is written onto the request and onto the response that will be returned. */
const requestAuthClient = (request: NextRequest, response: NextResponse): SupabaseClient =>
    createServerClient(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (changes) => {
                for (const change of changes) {
                    request.cookies.set(change.name, change.value)
                    response.cookies.set(change.name, change.value, { ...change.options, ...sessionCookieOptions })
                }
            },
        },
    })

/** Verifies the access token of a client (signature and expiry) through `getClaims()`; a token without a subject is refused. */
const verifySession = async (client: SupabaseClient): Promise<AuthOutcome<true>> => {
    const { data, error } = await client.auth.getClaims()
    const failed = failureOf<true>(error)
    if (failed !== undefined) return failed
    return typeof data?.claims.sub === "string" ? authOk(true) : authFailure("refused", "claims")
}

/** Refreshes the proxy cookies through `getClaims()` and answers whether the session is a verified one. */
export const refreshSession = async (request: NextRequest, response: NextResponse): Promise<AuthOutcome<true>> =>
    verifySession(requestAuthClient(request, response))

const EMAIL_LINK_TYPES: ReadonlyArray<EmailOtpType> = [
    "signup",
    "recovery",
    "invite",
    "email_change",
    "magiclink",
    "email",
]

const emailLinkTypeOf = (value: string): EmailOtpType | undefined => EMAIL_LINK_TYPES.find((type) => type === value)

/** Exchanges the one-time PKCE code; the session cookies are written into the jar. */
export const exchangeAuthCode = async (jar: SessionCookieJar, code: string): Promise<AuthOutcome<true>> => {
    const { error } = await cookieAuthClient(jar).auth.exchangeCodeForSession(code)
    return failureOf(error) ?? authOk(true)
}

/** Verifies an e-mail link (token hash and kind); the session cookies are written into the jar. */
export const verifyEmailLink = async (
    jar: SessionCookieJar,
    type: string,
    tokenHash: string,
): Promise<AuthOutcome<true>> => {
    const linkType = emailLinkTypeOf(type)
    if (linkType === undefined) return authFailure("invalid", "link-type")
    const { error } = await cookieAuthClient(jar).auth.verifyOtp({ type: linkType, token_hash: tokenHash })
    return failureOf(error) ?? authOk(true)
}
