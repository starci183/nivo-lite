import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.contracts"
import { SupabaseError, SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseOptions } from "./supabase.options"

/** The privileged surface exposed by this integration: Auth administration and Storage, never database queries. */
export interface SupabaseAdminClient {
    /** Supabase Auth administration. */
    readonly auth: SupabaseClient<Database>["auth"]["admin"]
    /** Supabase Storage administration. */
    readonly storage: SupabaseClient<Database>["storage"]
}

/** A password-authenticated session owned by one operator call; tokens remain inside its integration closure. */
export interface SupabaseUserSession {
    /** The identity Auth authenticated for this session. */
    readonly id: string
    /** Revokes only this owned session's refresh authority; access JWTs can remain valid until expiry. */
    readonly close: () => Promise<boolean>
}

/** The unprivileged Auth surface; session tokens never reach a domain caller. */
export interface SupabasePublicClient {
    /** Emails a one-time sign-in link and answers whether Auth sent it; it never creates an account. */
    readonly sendSignInLink: (email: string, redirectTo: string) => Promise<boolean>
    /** Opens an owned password session whose close handle must be awaited by the caller. */
    readonly openPasswordPrincipal: (email: string, password: string) => Promise<SupabaseUserSession | null>
    /** Validates a user token against Auth and returns only the Auth-confirmed user id. */
    readonly verifyUser: (token: string) => Promise<string | null>
}

const SERVER_AUTH = { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } as const
const verifiedUserId = (user: { readonly id: string } | null): string | null =>
    typeof user?.id === "string" && user.id.length > 0 ? user.id : null

/** Creates the back-end-only client and narrows it to Auth and Storage administration. */
export const createSupabaseAdminClient = (options: SupabaseOptions): SupabaseAdminClient => {
    const client: SupabaseClient<Database> = createClient<Database>(options.url, options.serviceRoleKey.reveal(), {
        auth: SERVER_AUTH,
    })
    return { auth: client.auth.admin, storage: client.storage }
}

/** Creates the publishable-key client; without its key every operation refuses without sending a request. */
export const createSupabasePublicClient = (options: SupabaseOptions): SupabasePublicClient => {
    const anonKey = options.anonKey
    if (anonKey === undefined)
        return {
            sendSignInLink: () => Promise.resolve(false),
            openPasswordPrincipal: () => Promise.resolve(null),
            verifyUser: () => Promise.resolve(null),
        }
    const newClient = (): SupabaseClient<Database> =>
        createClient<Database>(options.url, anonKey.reveal(), { auth: SERVER_AUTH })
    const client = newClient()
    return {
        sendSignInLink: async (email, redirectTo) => {
            const sent = await client.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
            })
            return sent.error === null
        },
        openPasswordPrincipal: async (email, password) => {
            const owned = newClient()
            try {
                const result = await owned.auth.signInWithPassword({ email, password })
                const id = result.error === null ? verifiedUserId(result.data.user) : null
                if (id === null) {
                    await owned.auth.signOut({ scope: "local" })
                    return null
                }
                let cleanup: boolean | undefined
                return {
                    id,
                    close: async () => {
                        if (cleanup !== undefined) return cleanup
                        try {
                            const result = await owned.auth.signOut({ scope: "local" })
                            cleanup = result.error === null
                        } catch (cause) {
                            cleanup = false
                            throw new SupabaseError({ code: SupabaseErrorCode.ProviderUnavailable, cause })
                        }
                        return cleanup
                    },
                }
            } catch (cause) {
                throw new SupabaseError({ code: SupabaseErrorCode.ProviderUnavailable, cause })
            }
        },
        verifyUser: async (token) => {
            try {
                const result = await client.auth.getUser(token)
                return result.error === null ? verifiedUserId(result.data.user) : null
            } catch (cause) {
                throw new SupabaseError({ code: SupabaseErrorCode.ProviderUnavailable, cause })
            }
        },
    }
}
