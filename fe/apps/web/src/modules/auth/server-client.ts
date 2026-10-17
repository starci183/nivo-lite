import type { GraphQLResponse } from "@/modules/types"
import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"
import { sessionCookieOptions, supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { authFailure, authOk, failureOf } from "./outcome"

/** A request cookie exposed by the framework cookie store. */
interface SessionCookie {
    readonly name: string
    readonly value: string
}

/** A cookie store supplied by the server entry, without importing request APIs into the proxy helpers. */
interface SessionCookieJar {
    readonly getAll: () => ReadonlyArray<SessionCookie>
    readonly set: (name: string, value: string, options: CookieOptions) => unknown
}

/** A cookie write a server component cannot make (only route handlers and the proxy may); the proxy refreshes those. */
const isReadOnlyCookieStore = (cause: unknown): boolean =>
    cause instanceof Error && cause.message.includes("Cookies can only be modified")

/** The cookie-backed server Auth client over the cookies of the current request. */
export const cookieAuthClient = (jar: SessionCookieJar): SupabaseClient =>
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
const verifySession = async (client: SupabaseClient): Promise<GraphQLResponse<true>> => {
    const { data, error } = await client.auth.getClaims()
    const failed = failureOf<true>(error)
    if (failed !== undefined) return failed
    return typeof data?.claims.sub === "string" ? authOk(true) : authFailure("refused", "claims")
}

/** Refreshes the proxy cookies through `getClaims()` and answers whether the session is a verified one. */
export const refreshSession = async (request: NextRequest, response: NextResponse): Promise<GraphQLResponse<true>> =>
    verifySession(requestAuthClient(request, response))
