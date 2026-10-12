import type { WorkspaceMember } from "@modules/domain/workspaces"
import type { RecordOutcomeRequest, RecordOutcomeResult } from "../../application/record-outcome.contracts"
import type { RecordOutcomeRequest as RecordOutcomeHttpRequest } from "./dto/record-outcome.request"
import type { RecordOutcomeResponse } from "./dto/record-outcome.response"

/** Maps the HTTP request, the path id, the admitted member and the request language to the command request. */
export const toRecordOutcomeRequest = (
    member: WorkspaceMember,
    leadId: string,
    input: RecordOutcomeHttpRequest,
    acceptLanguage: string | undefined,
): RecordOutcomeRequest => ({
    leadId,
    stage: input.stage,
    evidence: input.evidence,
    workspaceId: member.workspaceId,
    actor: { userId: member.userId, displayName: member.displayName },
    acceptLanguage,
})

/** Maps the command result to the HTTP response. */
export const toRecordOutcomeResponse = (result: RecordOutcomeResult): RecordOutcomeResponse => ({
    leadId: result.leadId,
    stage: result.stage,
    contactName: result.contactName,
    company: result.company,
    channel: result.channel,
    need: result.need,
    origin: result.origin,
    handedToAccounting: result.handedToAccounting,
})
