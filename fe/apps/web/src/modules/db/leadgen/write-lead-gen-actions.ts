"use server"
import "server-only"

import { decideWorkItem } from "@/lib/flow-actions"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { commentApprovalSchema } from "./leadgen.mapper"

/** Approves the drafted public reply of a comment, optionally with the text the person changed it to. */
export const writeApproveComment = async (input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = commentApprovalSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "comment-approval")
    const { workItemId, draft } = parsed.data
    const result = await decideWorkItem(workItemId, "approved", draft === null ? undefined : { draft })
    return result.ok ? dbOk({ id: result.data.id }) : dbFailure("unavailable", result.error)
}
