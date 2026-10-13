"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { contractSchema, toContract } from "../contracts/contracts.mapper"
import type { SalesContract } from "@/modules/types"

/** Adds or edits a recurring sales contract; the row policy proves the person is a member of the workspace. */
export const writeSaveContract = async (input: unknown): Promise<DbOutcome<SalesContract>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = contractSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "contract-input")
    const { id, workspaceId, ...fields } = parsed.data
    const row = {
        workspace_id: workspaceId,
        lead_id: fields.leadId,
        customer_name: fields.customerName.trim(),
        plan: fields.plan.trim(),
        starts_on: fields.startsOn,
        ends_on: fields.endsOn,
        amount_vnd: fields.amountVnd,
        status: fields.status,
        note: fields.note.trim(),
        updated_at: new Date().toISOString(),
    }
    const db = await createServerDbClient()
    const saved = toOutcome(
        id === null
            ? await db.from("contracts").insert(row).select().single()
            : await db.from("contracts").update(row).eq("id", id).eq("workspace_id", workspaceId).select().single(),
    )
    return saved.kind === "ok" ? { kind: "ok", value: toContract(saved.value) } : saved
}
