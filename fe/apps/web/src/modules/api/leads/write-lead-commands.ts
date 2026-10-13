"use server"

import "server-only"
import { apiRequest } from "../request"
import type { Outcome } from "../outcome"
import type { RecordedOutcomeItem, ResponsibilityItem } from "./leads.mapper"

/** What a person types to add or change the step of a lead. */
interface StepBody {
    /** `human` for the signed-in person, else the id of an agent. */
    readonly owner: string
    readonly nextAction: string
    /** ISO 8601, or null for no date. */
    readonly dueAt: string | null
}

/** Records a stage change of a lead with its evidence; the back end proves the membership. */
export const writeRecordOutcome = (
    workspaceId: string,
    leadId: string,
    stage: string,
    evidence: string,
): Promise<Outcome<RecordedOutcomeItem>> =>
    apiRequest<RecordedOutcomeItem>(`/leads/${encodeURIComponent(leadId)}/outcome`, {
        method: "POST",
        body: { stage, evidence },
        workspaceId,
    })

/** Adds the next step of a lead. */
export const writeAddResponsibility = (
    workspaceId: string,
    leadId: string,
    title: string,
    step: StepBody,
): Promise<Outcome<ResponsibilityItem>> =>
    apiRequest<ResponsibilityItem>(`/leads/${encodeURIComponent(leadId)}/responsibilities`, {
        method: "POST",
        body: { title, ...step },
        workspaceId,
    })

/** Changes the owner, the next action or the due date of a step. */
export const writeAssignResponsibility = (
    workspaceId: string,
    responsibilityId: string,
    step: StepBody,
): Promise<Outcome<ResponsibilityItem>> =>
    apiRequest<ResponsibilityItem>(`/responsibilities/${encodeURIComponent(responsibilityId)}`, {
        method: "PATCH",
        body: { ...step, title: null },
        workspaceId,
    })
