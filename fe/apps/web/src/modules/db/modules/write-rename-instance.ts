"use server"
import "server-only"

import { cleanInstanceName, instanceNameKey } from "@/modules/installations"
import type { Installation } from "@/modules/installations"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { nameSchema } from "./modules.mapper"
import { readInstallation } from "./read-installation"

const SIBLINGS_LIMIT = 200

/** Renames an instance (its label in lists, the chrome and Office); the name is unique per type in the workspace, case-insensitive. */
export const writeRenameInstance = async (input: unknown): Promise<DbOutcome<Installation>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = nameSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "rename-input")
    const name = cleanInstanceName(parsed.data.value)
    if (name === null) return dbFailure("invalid", "instance-name")
    const current = await readInstallation(parsed.data.id)
    if (current.kind !== "ok") return current
    const client = await createServerDbClient()
    const siblings = toOutcome(
        await client
            .from("module_installations")
            .select("id, name")
            .eq("workspace_id", current.value.workspaceId)
            .eq("module_key", current.value.moduleKey)
            .neq("id", current.value.id)
            .limit(SIBLINGS_LIMIT),
    )
    if (siblings.kind !== "ok" && siblings.kind !== "not-found") return siblings
    const taken = siblings.kind === "ok" ? siblings.value : []
    if (taken.some((other) => instanceNameKey(other.name) === instanceNameKey(name))) {
        return dbFailure("invalid", "instance-name-taken")
    }
    const updated = await client.from("module_installations").update({ name }).eq("id", current.value.id).select("id")
    if (updated.error !== null) return dbFailure("unavailable", updated.error.code)
    if (updated.data.length === 0) return dbFailure("refused", "not-a-manager")
    return readInstallation(current.value.id)
}
