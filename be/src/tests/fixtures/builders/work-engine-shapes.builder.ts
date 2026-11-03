import type { WorkItem, Proposal, ActionEntry, WorkSpec, DecisionsErrorCode } from "@modules/domain/decisions"
import type {
    ProposalCandidate,
    WorkExecutionOptions,
    GraphEvidence,
    ProposalFieldValue,
} from "@modules/domain/work-items"
import type { AuthorityRule } from "@modules/domain/authority-rules"

/** The candidates record the builders hand out and the specs expect. */
export type CandidatesShape = { id: string; label: string; amount_vnd: number }
/** The queued runs record the builders hand out and the specs expect. */
export type QueuedRunsShape2 = { limit: number; queued: WorkItem; count: number; reads: Array<Array<string>> }
/** The queued runs record the builders hand out and the specs expect. */
export type QueuedRunsShape = { limit: number; queued: null; count: number; reads: Array<Array<string>> }
/** The performer failures record the builders hand out and the specs expect. */
export type PerformerFailuresShape2 = { cause: string; message: string }
/** The performer failures record the builders hand out and the specs expect. */
export type PerformerFailuresShape = { cause: RangeError; message: string }
/** The idle runs record the builders hand out and the specs expect. */
export type IdleRunsShape = { label: string; created: boolean; queue: boolean; held: boolean }
/** The prepared address record the builders hand out and the specs expect. */
export type PreparedAddressShape = { proposal: Proposal; subjectType: string; subjectId: string; leadId: string }
/** The inbound reply seed record the builders hand out and the specs expect. */
export type InboundReplySeedShape = { summary: string }
/** The inbound reply record the builders hand out and the specs expect. */
export type InboundReplyShape = {
    action: string
    subject_type: string
    subject_id: string
    inbound_event_id: string
    lead_id: string
    dedupeKey: string
    seed: InboundReplySeedShape
}
/** The order seeds fields record the builders hand out and the specs expect. */
export type OrderSeedsFieldsShape = { items: string; amount_vnd: null }
/** The order seeds record the builders hand out and the specs expect. */
export type OrderSeedsShape2 = { amount_vnd: null; fields: OrderSeedsFieldsShape }
/** The order seeds fields record the builders hand out and the specs expect. */
export type OrderSeedsFieldsShapeOf = { items: string; amount_vnd: number }
/** The order seeds record the builders hand out and the specs expect. */
export type OrderSeedsShape = { amount_vnd: number; fields: OrderSeedsFieldsShapeOf }
/** The record only cases result record the builders hand out and the specs expect. */
export type RecordOnlyCasesResultShape = { summary: string }
/** The record only cases record the builders hand out and the specs expect. */
export type RecordOnlyCasesShape2 = { label: string; action: null; result: RecordOnlyCasesResultShape }
/** The record only cases result record the builders hand out and the specs expect. */
export type RecordOnlyCasesResultShapeOf = { summary: string }
/** The record only cases record the builders hand out and the specs expect. */
export type RecordOnlyCasesShape = { label: string; action: ActionEntry; result: RecordOnlyCasesResultShapeOf }
/** The inbound batches record the builders hand out and the specs expect. */
export type InboundBatchesShape = {
    limit: number
    queued: Array<WorkItem>
    claimed: Array<null>
    count: number
    reads: Array<Array<string>>
    claims: Array<Array<string>>
}
/** The diverted work seed fields record the builders hand out and the specs expect. */
export type DivertedWorkSeedFieldsShape = { to: string }
/** The diverted work seed record the builders hand out and the specs expect. */
export type DivertedWorkSeedShape = {
    fields: DivertedWorkSeedFieldsShape
    summary: string
    draft?: string | undefined
    amount_vnd?: number | null | undefined
    confidence?: number
    outcome?: "clear" | "unclear"
    candidates?: ReadonlyArray<ProposalCandidate> | undefined
    execution?: WorkExecutionOptions | undefined
    evidence?: ReadonlyArray<GraphEvidence> | undefined
}
/** The diverted work record the builders hand out and the specs expect. */
export type DivertedWorkShape = {
    action: string
    subject_type: string
    subject_id: string
    lead_id: string
    dedupeKey: string
    preset: boolean
    noChain: boolean
    forceAsk: string
    seed: DivertedWorkSeedShape
}
/** The blank patch record the builders hand out and the specs expect. */
export type BlankPatchShape = { proposal: Proposal; subjectType: null; subjectId: null; leadId: null }
/** The unasked diverted work seed fields record the builders hand out and the specs expect. */
export type UnaskedDivertedWorkSeedFieldsShape = { conversation_id: string }
/** The unasked diverted work seed record the builders hand out and the specs expect. */
export type UnaskedDivertedWorkSeedShape = {
    summary: string
    draft: string
    fields: UnaskedDivertedWorkSeedFieldsShape
}
/** The unasked diverted work record the builders hand out and the specs expect. */
export type UnaskedDivertedWorkShape = {
    subject_id: string
    dedupeKey: string
    origin: NonNullable<WorkSpec["origin"]> | null
    seed: UnaskedDivertedWorkSeedShape
}
/** The still missing data record the builders hand out and the specs expect. */
export type StillMissingDataShape = {
    proposal: Proposal
    missing: Array<string>
    reason: string
    reasons: Array<string>
}
/** The unclear gate verdict record the builders hand out and the specs expect. */
export type UnclearGateVerdictShape = { verdict: string; reason: string; reasons: Array<string>; missing: Array<never> }
/** The unclear gate record the builders hand out and the specs expect. */
export type UnclearGateShape = { verdict: UnclearGateVerdictShape; rule: AuthorityRule }
/** The durable preparation saved proposal execution record the builders hand out and the specs expect. */
export type DurablePreparationSavedProposalExecutionShape = { preset: undefined; noChain: boolean; forceAsk: undefined }
/** The durable preparation saved proposal record the builders hand out and the specs expect. */
export type DurablePreparationSavedProposalShape = {
    execution: DurablePreparationSavedProposalExecutionShape
    summary: string
    draft?: string | undefined
    amount_vnd?: number | null | undefined
    fields: Readonly<Record<string, ProposalFieldValue>>
    confidence?: number
    outcome?: "clear" | "unclear"
    candidates?: ReadonlyArray<ProposalCandidate> | undefined
    evidence?: ReadonlyArray<GraphEvidence> | undefined
}
/** The durable preparation saved record the builders hand out and the specs expect. */
export type DurablePreparationSavedShape = {
    proposal: DurablePreparationSavedProposalShape
    subjectType: null
    subjectId: null
    leadId: null
}
/** The durable preparation proposal execution record the builders hand out and the specs expect. */
export type DurablePreparationProposalExecutionShape = { noChain: boolean }
/** The durable preparation proposal record the builders hand out and the specs expect. */
export type DurablePreparationProposalShape = {
    execution: DurablePreparationProposalExecutionShape
    summary: string
    draft?: string | undefined
    amount_vnd?: number | null | undefined
    fields: Readonly<Record<string, ProposalFieldValue>>
    confidence?: number
    outcome?: "clear" | "unclear"
    candidates?: ReadonlyArray<ProposalCandidate> | undefined
    evidence?: ReadonlyArray<GraphEvidence> | undefined
}
/** The durable preparation record the builders hand out and the specs expect. */
export type DurablePreparationShape = {
    proposal: DurablePreparationProposalShape
    prepared: Proposal
    saved: DurablePreparationSavedShape
}
/** The auto finish args of result by record the builders hand out and the specs expect. */
export type AutoFinishArgsOfResultByShape = { name: string; kind: string }
/** The auto finish args of result record the builders hand out and the specs expect. */
export type AutoFinishArgsOfResultShape = { path: string; by: AutoFinishArgsOfResultByShape; outcome: string }
/** The graph rejection args of result record the builders hand out and the specs expect. */
export type GraphRejectionArgsOfResultShape = { name: string; kind: string }
/** The rejection mark args of result record the builders hand out and the specs expect. */
export type RejectionMarkArgsOfResultShape2 = { readonly summary: "engine.rejectedResult()" }
/** The rejection mark args of result record the builders hand out and the specs expect. */
export type RejectionMarkArgsOfResultShape = {
    readonly draft: "x"
    readonly summary: string
    readonly amount_vnd?: number | null | undefined
    readonly fields: Readonly<Record<string, ProposalFieldValue>>
    readonly confidence?: number
    readonly outcome?: "clear" | "unclear"
    readonly candidates?: ReadonlyArray<ProposalCandidate> | undefined
    readonly execution?: WorkExecutionOptions | undefined
    readonly evidence?: ReadonlyArray<GraphEvidence> | undefined
}
/** The auto notification failures record the builders hand out and the specs expect. */
export type AutoNotificationFailuresShape2 = { target: "continueChain"; cause: Error }
/** The auto notification failures record the builders hand out and the specs expect. */
export type AutoNotificationFailuresShape = { target: "finished"; cause: Error }
/** The rejected notification failure record the builders hand out and the specs expect. */
export type RejectedNotificationFailureShape = { target: "rejected"; cause: Error }
/** The missing fields error params record the builders hand out and the specs expect. */
export type MissingFieldsErrorParamsShape = { fields: string }
/** The missing fields error record the builders hand out and the specs expect. */
export type MissingFieldsErrorShape = { code: DecisionsErrorCode; params: MissingFieldsErrorParamsShape }
/** The choose candidate error record the builders hand out and the specs expect. */
export type ChooseCandidateErrorShape = { code: DecisionsErrorCode }
/** The authoritative rejection args of result record the builders hand out and the specs expect. */
export type AuthoritativeRejectionArgsOfResultShape = { readonly name: "Lan"; readonly kind: "owner" }
