import "server-only"

import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { EVIDENCE_LIMIT, evidenceToJson } from "./content.mapper"
import { readContentItem } from "./read-items"
import type { EvidenceLine } from "@/modules/content"

/** An insert whose row is not read back: ok when the database raised no error. */
const written = (result: {
    readonly error: { readonly message: string; readonly code?: string } | null
}): DbOutcome<null> => {
    const checked = toOutcome({ data: true, error: result.error })
    return checked.kind === "ok" ? dbOk(null) : checked
}

/** One line to add to the history of a post. */
export interface EvidenceInput {
    readonly kind: string
    readonly by: string
    readonly text: string
    readonly at?: string
}

/**
 * Appends one history line (who did what, and what proves it) to a post. Server-internal: not a Server Action, because the line
 * is written by the commands that already checked who may act.
 */
export const appendItemEvidence = async (
    workspaceId: string,
    itemId: string,
    line: EvidenceInput,
): Promise<DbOutcome<null>> => {
    const item = await readContentItem(workspaceId, itemId)
    if (item.kind !== "ok") return item.kind === "not-found" ? dbOk(null) : item
    const next: Array<EvidenceLine> = [
        ...item.value.evidence,
        { at: line.at ?? new Date().toISOString(), kind: line.kind, by: line.by, text: line.text },
    ].slice(-EVIDENCE_LIMIT)
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({ evidence: evidenceToJson(next) })
            .eq("id", itemId)
            .eq("workspace_id", workspaceId)
            .select("id")
            .single(),
    )
    return saved.kind === "ok" ? dbOk(null) : saved
}

/** One audit event of the workspace. */
export interface EventInput {
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly evidence: string | null
}

/** Appends one line to the workspace audit log (events). Server-internal. */
export const appendWorkspaceEvent = async (workspaceId: string, event: EventInput): Promise<DbOutcome<null>> => {
    const client = await createServerDbClient()
    const result = await client.from("events").insert({
        workspace_id: workspaceId,
        kind: event.kind,
        actor: event.actor,
        summary: event.summary,
        evidence: event.evidence,
    })

    return written(result)
}

/** One routine decision of the policy. */
export interface DecisionInput {
    readonly action: string
    readonly department: string
    readonly decidedBy: string
    readonly note: string
}

/** Appends one automatic decision (the drafting policy) to the decision log. Server-internal. */
export const appendPolicyDecision = async (workspaceId: string, decision: DecisionInput): Promise<DbOutcome<null>> => {
    const client = await createServerDbClient()
    const result = await client.from("decisions").insert({
        workspace_id: workspaceId,
        department: decision.department,
        action: decision.action,
        decided_by: decision.decidedBy,
        decider_kind: "policy",
        outcome: "auto_done",
        reason: "routine",
        note: decision.note,
    })

    return written(result)
}
