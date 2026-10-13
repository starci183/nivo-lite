"use server"
import "server-only"

import { getLocale } from "next-intl/server"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import {
    addStepSchema,
    assignStepSchema,
    outcomeInputSchema,
    recordedOutcomeOf,
    responsibilityOf,
} from "./lead-steps.mapper"
import type { RecordedOutcomeItem, ResponsibilityItem } from "./lead-steps.mapper"

/** The language the evidence and chat lines are written in. */
const languageOf = async (): Promise<"vi" | "en"> => ((await getLocale()) === "en" ? "en" : "vi")

/** Records a stage change of a lead with its evidence; the database function proves the membership and writes the evidence and chat lines. */
export const writeRecordOutcome = async (
    workspaceId: string,
    leadId: string,
    stage: string,
    evidence: string,
): Promise<DbOutcome<RecordedOutcomeItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = outcomeInputSchema.safeParse(workspaceId, leadId, stage, evidence)
    if (!parsed.success) return dbFailure("invalid", "outcome-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("record_lead_outcome", {
        p_workspace: parsed.data.workspaceId,
        p_lead: parsed.data.leadId,
        p_stage: parsed.data.stage,
        p_evidence: parsed.data.evidence,
        p_locale: await languageOf(),
    })
    if (error !== null) return rpcFailure(error)
    const item = recordedOutcomeOf(data)
    return item === null ? dbFailure("unavailable", "outcome-shape") : dbOk(item)
}

/** Adds the next step of a lead. */
export const writeAddResponsibility = async (
    workspaceId: string,
    leadId: string,
    title: string,
    input: unknown,
): Promise<DbOutcome<ResponsibilityItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = addStepSchema.safeParse(workspaceId, leadId, title, input)
    if (!parsed.success) return dbFailure("invalid", "responsibility-input")
    const { step } = parsed.data
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("add_lead_responsibility", {
        p_workspace: parsed.data.workspaceId,
        p_lead: parsed.data.leadId,
        p_title: parsed.data.title,
        p_owner: step.owner,
        p_next_action: step.nextAction.trim(),
        ...(step.dueAt === null ? {} : { p_due: step.dueAt }),
        p_locale: await languageOf(),
    })
    if (error !== null) return rpcFailure(error)
    const item = responsibilityOf(data)
    return item === null ? dbFailure("unavailable", "responsibility-shape") : dbOk(item)
}

/** Changes the owner, the next action or the due date of a step. */
export const writeAssignResponsibility = async (
    workspaceId: string,
    responsibilityId: string,
    input: unknown,
): Promise<DbOutcome<ResponsibilityItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = assignStepSchema.safeParse(workspaceId, responsibilityId, input)
    if (!parsed.success) return dbFailure("invalid", "responsibility-input")
    const { step } = parsed.data
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("assign_lead_responsibility", {
        p_workspace: parsed.data.workspaceId,
        p_responsibility: parsed.data.responsibilityId,
        p_owner: step.owner,
        p_next_action: step.nextAction.trim(),
        ...(step.dueAt === null ? {} : { p_due: step.dueAt }),
        p_locale: await languageOf(),
    })
    if (error !== null) return rpcFailure(error)
    const item = responsibilityOf(data)
    return item === null ? dbFailure("unavailable", "responsibility-shape") : dbOk(item)
}
