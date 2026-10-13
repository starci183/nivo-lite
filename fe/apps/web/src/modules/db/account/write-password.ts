"use server"
import "server-only"

import { createClient } from "@supabase/supabase-js"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { passwordInputSchema } from "./account.mapper"

/**
 * Changes the password. The current one is verified on a throwaway client (the browser session is untouched), then the new one
 * is set; the verification session is closed so it never shows up in the device list.
 */
export const writePassword = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    if (principal.value.email === undefined) return dbFailure("invalid", "no-password")
    const parsed = passwordInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "password-input")
    const probe = createClient(supabaseUrl(), supabaseAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const verified = toOutcome(
        await probe.auth.signInWithPassword({ email: principal.value.email, password: parsed.data.current }),
    )
    await probe.auth.signOut()
    if (verified.kind !== "ok") return dbFailure("refused", "wrong-current")
    const client = await createServerDbClient()
    const updated = toOutcome(await client.auth.updateUser({ password: parsed.data.next }))
    return updated.kind === "ok" ? dbOk(true) : updated
}
