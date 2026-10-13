"use server"
import "server-only"

import type { Installation } from "@/modules/installations"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { liveSchema } from "./modules.mapper"
import { readInstallation } from "./read-installation"

/** Switches an agent live (it acts on channels) or paused (it stays silent); going live needs an applied context version. */
export const writeModuleLive = async (input: unknown): Promise<DbOutcome<Installation>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = liveSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "live-input")
    const current = await readInstallation(parsed.data.id)
    if (current.kind !== "ok") return current
    if (parsed.data.value && current.value.activeContextVersionId === null) return dbFailure("invalid", "needs-version")
    const client = await createServerDbClient()
    const updated = await client
        .from("module_installations")
        .update({ live_enabled: parsed.data.value, status: parsed.data.value ? "live" : "paused" })
        .eq("id", current.value.id)
        .select("id")
    if (updated.error !== null) return dbFailure("unavailable", updated.error.code)
    if (updated.data.length === 0) return dbFailure("refused", "not-a-manager")
    if (current.value.agentId !== null) {
        const agent = await client
            .from("agents")
            .update({ status: parsed.data.value ? "active" : "paused" })
            .eq("id", current.value.agentId)
        if (agent.error !== null) return dbFailure("unavailable", agent.error.code)
    }
    return readInstallation(current.value.id)
}
