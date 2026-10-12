import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerDbClient } from "@/modules/db/server"

/** Shim for Wave 3: the cookie-backed server client now comes from modules/db; the untyped shape older callers query with stays. */
export const supabaseServer = async (): Promise<SupabaseClient> =>
    (await createServerDbClient()) as unknown as SupabaseClient
