"use client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createBrowserDbClient } from "@/modules/db/browser"

/** Shim for Wave 3: the browser client now comes from modules/db; the untyped shape older callers use stays. */
export const supabaseBrowser = (): SupabaseClient => createBrowserDbClient() as unknown as SupabaseClient
