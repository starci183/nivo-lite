"use server"
import "server-only"

import { decideExecution } from "@/lib/actions"
import { decideWorkItem } from "@/lib/flow-actions"
import type { WorkItem } from "@/lib/flow-types"
import type { Outcome } from "@/lib/types"
import { handoffToAccounting, markOrderShipped, retryFailedStep, stopFailedStep } from "./engine-commands"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { decisionSchema, failedStepSchema, salesIdSchema, shipSchema } from "../salesinput/salesinput.mapper"

/** The engine answers a sentence for a refusal; it travels as the failure code so the screen can show it. */
const outcomeOf = <T>(result: Outcome<T>): DbOutcome<T> =>
    result.ok ? dbOk(result.data) : dbFailure("unavailable", result.error)

/** Tries a failed step again or stops it for good. */
export const writeFailedStep = async (input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = failedStepSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "work-item")
    const { id, action } = parsed.data
    return outcomeOf(await (action === "retry" ? retryFailedStep(id) : stopFailedStep(id)))
}

/** Hands a confirmed order to Accounting. */
export const writeHandoffToAccounting = async (
    input: unknown,
): Promise<DbOutcome<{ readonly status: WorkItem["status"] }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = salesIdSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "order")
    return outcomeOf(await handoffToAccounting(parsed.data))
}

/** Records the carrier and tracking code of an order. */
export const writeMarkShipped = async (input: unknown): Promise<DbOutcome<{ readonly orderNo: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = shipSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "shipment")
    return outcomeOf(await markOrderShipped(parsed.data.orderId, parsed.data))
}

/** Decides a work item waiting for a person. */
export const writeDecideWorkItem = async (input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = decisionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "decision")
    const result = await decideWorkItem(parsed.data.id, parsed.data.decision, parsed.data.edits)
    return result.ok ? dbOk({ id: result.data.id }) : dbFailure("unavailable", result.error)
}

/** Decides a legacy draft waiting for approval. */
export const writeDecideDraft = async (input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = decisionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "decision")
    const result = await decideExecution(parsed.data.id, parsed.data.decision, parsed.data.editedDraft)
    return result.ok ? dbOk({ id: result.data.id }) : dbFailure("unavailable", result.error)
}
