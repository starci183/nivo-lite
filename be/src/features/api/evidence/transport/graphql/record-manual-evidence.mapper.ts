import type { RecordManualEvidenceRequest } from "../../application/record-manual-evidence.contracts"
import type { RecordManualEvidenceInput } from "./dto/record-manual-evidence.input"
import type { ManualEvidenceType } from "./dto/manual-evidence.type"

/** Maps the GraphQL input to the request. */
export const toRecordManualEvidenceRequest = (workspaceId: string, input: RecordManualEvidenceInput): RecordManualEvidenceRequest => ({
    workspaceId,
    amount: input.amount,
    date: input.date,
    content: input.content,
    note: input.note,
    payer: input.payer,
})

/** Maps the answer to the GraphQL type. */
export const toRecordManualEvidenceType = (result: boolean): ManualEvidenceType => ({ duplicate: result })
