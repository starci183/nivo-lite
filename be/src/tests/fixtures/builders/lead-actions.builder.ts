import { builder } from "@starci/jest-preset"
import type { QueryBuilderAnswers } from "./entity-query-builder-fake.builder"
import type { LeadActionRun } from "@modules/domain/lead-actions"
import type { LeadRecordRow } from "@modules/domain/leads"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The active workspace owner requesting a queued lead action. */
export const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

/** The customer addressed by queued lead actions. */
export const leadOf = builder<LeadRecordRow>({
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
})

const LEAD = "11111111-1111-4111-8111-111111111111"

/** A claimed run of a refresh-context action. */
export const running: LeadActionRun = {
    id: "run-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    action: "refresh-context",
    input: { leadId: LEAD },
    locale: "vi",
    status: "running",
    result: null,
    errorCode: null,
}

/** The RETURNING row of a write that answered this run, as the database names its columns. */
export const returnedRun = (run: LeadActionRun): QueryBuilderAnswers => ({
    execute: {
        raw: [
            {
                id: run.id,
                workspace_id: run.workspaceId,
                requested_by: run.requestedBy,
                action: run.action,
                input: run.input,
                locale: run.locale,
                status: run.status,
                result: run.result,
                error_code: run.errorCode,
            },
        ],
    },
})

/** The answer of a fenced write that changed one run, or none. */
export const owned: QueryBuilderAnswers = { execute: { raw: [{ id: "run-1" }] } }
export const lost: QueryBuilderAnswers = { execute: { raw: [] } }

/** The where of a write under the fence job-1 / 7 of a running run-1. */
export const FENCE = { id: "run-1", workspaceId: "ws-1", jobId: "job-1", fencingToken: 7, status: "running" }
