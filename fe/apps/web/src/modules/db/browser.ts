import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the typed public client used by client-side auth lifecycle hooks and realtime. */
export const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())

/** Owns the browser Auth subscription and exposes only its lifecycle to client hooks. */
export const subscribeToAuthRefresh = (refresh: () => void): (() => void) => {
    const listener = createBrowserDbClient().auth.onAuthStateChange(refresh)
    return () => listener.data.subscription.unsubscribe()
}

/** A table of the public schema, as the generated contract names it. */
type PublicTable = keyof Database["public"]["Tables"]

/** Which changes of one workspace to listen to, and what to do when one arrives. */
export interface WorkspaceChangeSubscription {
    readonly channel: string
    readonly workspaceId: string
    readonly tables: ReadonlyArray<PublicTable>
    readonly onChange: (table: PublicTable) => void
}

/** Listens to Realtime changes of the given tables inside one workspace and returns the function that stops listening. */
export const subscribeToWorkspaceChanges = (subscription: WorkspaceChangeSubscription): (() => void) => {
    const client = createBrowserDbClient()
    const channel = client.channel(subscription.channel)
    for (const table of subscription.tables) {
        channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter: `workspace_id=eq.${subscription.workspaceId}` },
            () => subscription.onChange(table),
        )
    }
    channel.subscribe()
    return () => {
        void client.removeChannel(channel)
    }
}
