"use server"
import "server-only"

import { createLead, draftExecution, refreshContext, suggestResponsibility } from "@/lib/actions"
import { settleWonDeal } from "./engine-won"
import type { Outcome } from "@/lib/types"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { newLeadSchema } from "./leads.mapper"

/** The engine answers a sentence for a refusal; it travels as the failure code so the screen can show it. */
const outcomeOf = <T>(result: Outcome<T>): DbOutcome<T> =>
    result.ok ? dbOk(result.data) : dbFailure("unavailable", result.error)

/** Wave-3 shims over the engine actions the lead screens still call: each refuses an anonymous caller first. */
const forMember = async <T>(run: () => Promise<Outcome<T>>): Promise<DbOutcome<T>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    return outcomeOf(await run())
}

/** Captures a lead by hand; the engine adds context and an owner through the authority gate. */
export const writeCreateLead = async (input: unknown): Promise<DbOutcome<{ readonly leadId: string }>> => {
    const parsed = newLeadSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "lead-input")
    return forMember(() => createLead(parsed.data))
}

/** Prepares the AI brief of a lead again. */
export const writeRefreshContext = async (leadId: string): Promise<DbOutcome<string>> =>
    forMember(() => refreshContext(leadId))

/** Asks the AI to propose the owner and next step of a lead that has none. */
export const writeSuggestOwner = async (leadId: string): Promise<DbOutcome<{ readonly id: string }>> =>
    forMember(async () => {
        const result = await suggestResponsibility(leadId)
        return result.ok ? { ok: true as const, data: { id: result.data.id } } : result
    })

/** Has the owning agent draft the message of a step. */
export const writeDraftExecution = async (responsibilityId: string): Promise<DbOutcome<{ readonly id: string }>> =>
    forMember(async () => {
        const result = await draftExecution(responsibilityId)
        return result.ok ? { ok: true as const, data: { id: result.data.id } } : result
    })

/** Runs what still lives in the engine after the back end recorded a won deal: the invoice step and the deal.won event. */
export const writeSettleWonDeal = async (leadId: string, evidence: string): Promise<DbOutcome<null>> =>
    forMember(() => settleWonDeal(leadId, evidence))
