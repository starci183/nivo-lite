"use server"
import "server-only"

import { decideWorkItem } from "@/lib/flow-actions"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"

/** Approves a decision that waits for the owner; an edited draft text replaces the drafted message. */
export const writeApproveWork = async (workItemId: string, editedDraft: string | null): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const result = await decideWorkItem(
        workItemId,
        "approved",
        editedDraft === null ? undefined : { draft: editedDraft },
    )
    return result.ok ? dbOk(null) : dbFailure("unavailable", result.error)
}

/** Rejects a decision that waits for the owner, with the reason the screen names. */
export const writeRejectWork = async (workItemId: string, note: string): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const result = await decideWorkItem(workItemId, "rejected", undefined, note)
    return result.ok ? dbOk(null) : dbFailure("unavailable", result.error)
}
