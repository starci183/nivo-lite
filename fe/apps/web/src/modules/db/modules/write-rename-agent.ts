"use server"
import "server-only"

import { AGENT_NAME_LIMITS, nameSchema } from "./modules.mapper"
import type { Installation } from "@/modules/installations"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { readInstallation } from "./read-installation"

/** Renames the agent of an installation (the display name its team sees in Office and on cards). */
export const writeRenameAgent = async (input: unknown): Promise<DbOutcome<Installation>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = nameSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "rename-input")
    const name = parsed.data.value.trim().slice(0, AGENT_NAME_LIMITS.max)
    if (name.length < AGENT_NAME_LIMITS.min) return dbFailure("invalid", "agent-name")
    const current = await readInstallation(parsed.data.id)
    if (current.kind !== "ok") return current
    if (current.value.agentId === null) return dbFailure("not-found", "agent")
    const client = await createServerDbClient()
    const updated = await client.from("agents").update({ name }).eq("id", current.value.agentId).select("id")
    if (updated.error !== null) return dbFailure("unavailable", updated.error.code)
    if (updated.data.length === 0) return dbFailure("refused", "not-a-manager")
    return readInstallation(current.value.id)
}
