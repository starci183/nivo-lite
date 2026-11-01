import type { BranchDivert } from "@modules/domain/authority-rules"
import type { ReasonCode, SubjectType } from "@modules/domain/work-items"
import type { Proposal, WorkOrigin, WorkSpec } from "./decisions.contracts"

const BRANCH_ASK: ReasonCode = "branch_ask"

/** The subject a diverted action inherits. */
export interface DivertSource {
    /** What makes this diversion one piece of work. */
    readonly key: string
    /** The type of the subject. */
    readonly subjectType: SubjectType
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** The agent instance, or null. */
    readonly installationId: string | null
    /** The turn and wake it came from, or null. */
    readonly origin: WorkOrigin | null
    /** What the agent proposed. */
    readonly proposal: Partial<Proposal>
}

/** The work a branch leads to in place of the proposal: the same subject, a person deciding when the path went through an approval. */
export const divertSpecOf = (divert: BranchDivert, source: DivertSource): WorkSpec => ({
    action: divert.action,
    subject_type: source.subjectType,
    subject_id: source.subjectId,
    lead_id: source.leadId,
    dedupeKey: `graph:${source.key}:${divert.action}`,
    preset: true,
    noChain: true,
    installationId: source.installationId,
    ...(source.origin === null ? {} : { origin: source.origin }),
    ...(divert.asks ? { forceAsk: BRANCH_ASK } : {}),
    seed: {
        ...source.proposal,
        fields: {
            ...source.proposal.fields,
            ...(source.subjectType === "conversation" ? { conversation_id: source.subjectId } : {}),
            ...(divert.handoverTo === null ? {} : { to: divert.handoverTo }),
        },
    },
})
