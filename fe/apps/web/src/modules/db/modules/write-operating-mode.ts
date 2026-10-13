"use server"
import "server-only"

import type { Installation } from "@/modules/installations"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { modeSchema } from "./modules.mapper"
import { readInstallation } from "./read-installation"

/** Sets how an agent runs: autopilot applies the authority rules as configured, assist downgrades every automatic action to a question. */
export const writeOperatingMode = async (input: unknown): Promise<DbOutcome<Installation>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = modeSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "mode-input")
    const client = await createServerDbClient()
    const updated = await client
        .from("module_installations")
        .update({ operating_mode: parsed.data.value })
        .eq("id", parsed.data.id)
        .select("id")
    if (updated.error !== null) return dbFailure("unavailable", updated.error.code)
    if (updated.data.length === 0) return dbFailure("refused", "not-a-manager")
    return readInstallation(parsed.data.id)
}
