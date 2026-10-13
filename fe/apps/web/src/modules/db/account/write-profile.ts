"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { profileInputSchema } from "./account.mapper"

/**
 * Saves the display name: the auth metadata first (the shell reads it), then every active membership row through the members
 * schema's own RPC (the members table is writable by managers only, so a plain update would touch nothing for staff).
 */
export const writeProfile = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = profileInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "profile-input")
    const client = await createServerDbClient()
    const saved = toOutcome(await client.auth.updateUser({ data: { full_name: parsed.data.name } }))
    if (saved.kind !== "ok") return saved
    const memberships = toOutcome(
        await client
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", principal.value.id)
            .eq("status", "active")
            .limit(500),
    )
    if (memberships.kind !== "ok") return memberships
    const synced = await Promise.all(
        memberships.value.map(async (row) =>
            toOutcome(
                await client.rpc("update_my_profile", { ws: row.workspace_id, new_display_name: parsed.data.name }),
            ),
        ),
    )
    const failed = synced.find((outcome) => outcome.kind !== "ok" && outcome.kind !== "not-found")
    return failed === undefined ? dbOk(true) : dbFailure("unavailable", "member-sync")
}
