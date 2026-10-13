"use server"
import "server-only"

import { decideWorkItem } from "@/lib/flow-actions"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { decisionSchema } from "./inventory.mapper"

/** Approves a decision that waits for the owner; an edited draft text replaces the drafted message. */
export const writeApproveWork = async (input: unknown): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = decisionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "inventory-decision")
    const result = await decideWorkItem(
        parsed.data.workItemId,
        "approved",
        parsed.data.note === null ? undefined : { draft: parsed.data.note },
    )
    return result.ok ? dbOk(null) : dbFailure("unavailable", result.error)
}

/** Rejects a decision that waits for the owner, with the reason the screen names. */
export const writeRejectWork = async (input: unknown): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = decisionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "inventory-decision")
    const result = await decideWorkItem(parsed.data.workItemId, "rejected", undefined, parsed.data.note ?? undefined)
    return result.ok ? dbOk(null) : dbFailure("unavailable", result.error)
}
