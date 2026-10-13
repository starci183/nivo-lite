"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { adjustmentSchema } from "./adjustments.mapper"

/** The client the writer reads and writes through. */
type DbClient = Awaited<ReturnType<typeof createServerDbClient>>

/** The record a correction points at and the lead behind it, read under the caller's RLS inside the workspace. */
const findTarget = async (
    client: DbClient,
    workspaceId: string,
    targetType: "invoice" | "transaction",
    targetId: string,
): Promise<DbOutcome<{ readonly leadId: string | null }>> => {
    if (targetType === "invoice") {
        const rows = toOutcome(
            await client
                .from("invoices")
                .select("id, lead_id")
                .eq("id", targetId)
                .eq("workspace_id", workspaceId)
                .limit(1),
        )
        if (rows.kind !== "ok") return rows
        const row = rows.value[0]
        return row === undefined ? dbFailure("not-found", "adjustment-target") : dbOk({ leadId: row.lead_id })
    }
    const rows = toOutcome(
        await client.from("transactions").select("id").eq("id", targetId).eq("workspace_id", workspaceId).limit(1),
    )
    if (rows.kind !== "ok") return rows
    return rows.value[0] === undefined ? dbFailure("not-found", "adjustment-target") : dbOk({ leadId: null })
}

/** The id of the correction that was recorded. */
export interface AdjustmentResult {
    readonly id: string
}

/**
 * Owner or manager adds a correction. History is append-only: the note, who and when are kept, plus an event in the
 * evidence log. The target must be a record of the caller's own workspace.
 */
export const writeAdjustment = async (input: unknown): Promise<DbOutcome<AdjustmentResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = adjustmentSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `adjustment-${parsed.field}`)
    const { targetType, targetId, note, correctedAmount } = parsed.data
    const session = await getSession()
    if (!isManagerRole(session.member.role)) return dbFailure("refused", "adjustment-role")
    const workspaceId = session.workspace.id
    const client = await createServerDbClient()
    const target = await findTarget(client, workspaceId, targetType, targetId)
    if (target.kind !== "ok") return target
    const found = target.value
    const inserted = toOutcome(
        await client
            .from("accounting_adjustments")
            .insert({
                workspace_id: workspaceId,
                target_type: targetType,
                target_id: targetId,
                note,
                corrected_amount_vnd: correctedAmount,
                created_by: session.member.displayName,
            })
            .select("id")
            .single(),
    )
    if (inserted.kind !== "ok") return inserted
    const t = await getTranslations("workbenchAccounting")
    const logged = toOutcome(
        await client
            .from("events")
            .insert({
                workspace_id: workspaceId,
                lead_id: found.leadId,
                kind: "accounting.adjustment",
                actor: session.member.displayName,
                summary: t(correctedAmount === null ? "adjustLog" : "adjustLogAmount", {
                    note,
                    amount: correctedAmount ?? 0,
                }),
                evidence: note,
            })
            .select("id"),
    )
    revalidatePath("/", "layout")
    if (logged.kind !== "ok") return logged
    return dbOk({ id: inserted.value.id })
}
