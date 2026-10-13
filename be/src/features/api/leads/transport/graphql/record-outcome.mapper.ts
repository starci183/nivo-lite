import type { RecordOutcomeRequest, RecordOutcomeResult } from "../../application/record-outcome.contracts"
import type { RecordOutcomeInput } from "./dto/record-outcome.input"
import type { RecordOutcomeType } from "./dto/record-outcome.type"

/** Maps the input and request context to a lead outcome command. */
export const toRecordOutcomeRequest = (
    workspaceId: string,
    input: RecordOutcomeInput,
    acceptLanguage: string,
): RecordOutcomeRequest => ({
    leadId: input.leadId,
    stage: input.stage,
    evidence: input.evidence,
    workspaceId,
    acceptLanguage,
})

/** Maps the recorded lead outcome to the GraphQL type. */
export const toRecordOutcomeType = (result: RecordOutcomeResult): RecordOutcomeType => ({ ...result })
