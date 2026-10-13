"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { settingsSchema, toJsonObject } from "./modules.mapper"

/**
 * Merges one setting into the settings of an installation: the longest a customer waits before the app answers directly
 * (`openclawTimeoutSec`) or the holding message (`holdingMessage`, empty removes it). Owners and managers only, by row level security.
 */
export const writeInstallationSettings = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = settingsSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "settings-input")
    const client = await createServerDbClient()
    const current = toOutcome(
        await client.from("module_installations").select("settings").eq("id", parsed.data.id).maybeSingle(),
    )
    if (current.kind !== "ok") return current
    const { name, value } = parsed.data.value
    const base = toJsonObject(current.value.settings) ?? {}
    const merged = Object.fromEntries(Object.entries({ ...base, [name]: value }).filter(([, kept]) => kept !== null))
    const updated = await client
        .from("module_installations")
        .update({ settings: merged })
        .eq("id", parsed.data.id)
        .select("id")
    if (updated.error !== null) return dbFailure("unavailable", updated.error.code)
    return updated.data.length === 0 ? dbFailure("refused", "not-a-manager") : dbOk(true)
}
