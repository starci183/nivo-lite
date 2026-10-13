import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sessionCookieOptions, supabaseAnonKey, supabaseUrl } from "@/modules/config"

let client: SupabaseClient | undefined

/**
 * The one browser Supabase client. The front end uses it for Auth only (sign-in, session, token); data reads and writes go
 * through the back end GraphQL API. The session lives in the cookie the proxy reads to gate routes.
 */
export const authClient = (): SupabaseClient => {
    client ??= createBrowserClient(supabaseUrl(), supabaseAnonKey(), { cookieOptions: sessionCookieOptions })
    return client
}
