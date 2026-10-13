import { useMemo } from "react"
import type { DbOutcome } from "@/modules/db/outcome"
import {
    writeAddResponsibility,
    writeAssignResponsibility,
    writeRecordOutcome,
} from "@/modules/db/leads/write-lead-commands"
import type { RecordedOutcomeItem, ResponsibilityItem } from "@/modules/db/leads/lead-steps.mapper"
import type { LeadStageId } from "@/modules/types"

/** What a person types to add or change the step of a lead. */
interface StepInput {
    /** `human` for the signed-in person, else the id of an agent. */
    readonly owner: string
    readonly nextAction: string
    /** ISO 8601, or null for no date. */
    readonly dueAt: string | null
}

/** The calls the lead screens make to the database. */
interface LeadCommands {
    readonly recordOutcome: (
        leadId: string,
        stage: LeadStageId,
        evidence: string,
    ) => Promise<DbOutcome<RecordedOutcomeItem>>
    readonly addResponsibility: (
        leadId: string,
        title: string,
        input: StepInput,
    ) => Promise<DbOutcome<ResponsibilityItem>>
    readonly assignResponsibility: (
        responsibilityId: string,
        input: StepInput,
    ) => Promise<DbOutcome<ResponsibilityItem>>
}

/** The lead commands of one workspace, run as Server Actions the database function proves the membership. */
export const useLeadCommands = (workspaceId: string): LeadCommands =>
    useMemo<LeadCommands>(
        () => ({
            recordOutcome: (leadId, stage, evidence) => writeRecordOutcome(workspaceId, leadId, stage, evidence),
            addResponsibility: (leadId, title, input) => writeAddResponsibility(workspaceId, leadId, title, input),
            assignResponsibility: (responsibilityId, input) =>
                writeAssignResponsibility(workspaceId, responsibilityId, input),
        }),
        [workspaceId],
    )
