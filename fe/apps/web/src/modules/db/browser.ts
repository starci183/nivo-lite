import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { dbFailure, dbOk, toOutcome } from "./outcome"
import type { DbOutcome } from "./outcome"

/** Creates the typed public client used by client-side auth lifecycle hooks and realtime. */
export const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())

/** Owns the browser Auth subscription and exposes only its lifecycle to client hooks. */
export const subscribeToAuthRefresh = (refresh: () => void): (() => void) => {
    const listener = createBrowserDbClient().auth.onAuthStateChange(refresh)
    return () => listener.data.subscription.unsubscribe()
}

/** The signed-in person's access token as the browser holds it, for a call to the back end api that verifies it. */
export const readBrowserAccessToken = async (): Promise<DbOutcome<string>> => {
    const session = toOutcome(await createBrowserDbClient().auth.getSession())
    if (session.kind !== "ok") return session
    const token = session.value.session?.access_token
    return token === undefined ? dbFailure("refused", "session") : dbOk(token)
}
