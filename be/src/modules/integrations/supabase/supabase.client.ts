import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupabaseOptions } from "./supabase.options"

/** The privileged surface exposed by this integration: Auth administration and Storage, never database queries. */
export interface SupabaseAdminClient {
    /** Supabase Auth administration. */
    readonly auth: SupabaseClient["auth"]["admin"]
    /** Supabase Storage administration. */
    readonly storage: SupabaseClient["storage"]
}

/** The unprivileged surface: only the Auth call that emails a sign-in link to an existing account. */
export interface SupabasePublicClient {
    /** Emails a one-time sign-in link and answers whether Auth sent it; it never creates an account. */
    readonly sendSignInLink: (email: string, redirectTo: string) => Promise<boolean>
}

const SERVER_AUTH = { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } as const

/** Creates the back-end-only client and narrows it to Auth and Storage administration. */
export const createSupabaseAdminClient = (options: SupabaseOptions): SupabaseAdminClient => {
    const client: SupabaseClient = createClient(options.url, options.serviceRoleKey.reveal(), {
        auth: SERVER_AUTH,
    })
    return { auth: client.auth.admin, storage: client.storage }
}

/** Creates the publishable-key client; without a publishable key it sends nothing and always answers false. */
export const createSupabasePublicClient = (options: SupabaseOptions): SupabasePublicClient => {
    if (options.anonKey === undefined) return { sendSignInLink: () => Promise.resolve(false) }
    const client: SupabaseClient = createClient(options.url, options.anonKey.reveal(), {
        auth: SERVER_AUTH,
    })
    return {
        sendSignInLink: async (email, redirectTo) => {
            const sent = await client.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
            })
            return sent.error === null
        },
    }
}
