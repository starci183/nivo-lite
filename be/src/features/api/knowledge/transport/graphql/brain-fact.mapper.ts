import type { FactRecord } from "@modules/domain/brain-facts"
import type { BrainFactType } from "./dto/brain-fact.type"
import { toFactEvidenceType } from "./brain-evidence.mapper"

/** Maps a fact to the GraphQL type. */
export const toBrainFactType = (fact: FactRecord): BrainFactType => ({
    id: fact.id,
    subjectType: fact.subjectType,
    subjectKey: fact.subjectKey,
    subjectLabel: fact.subjectLabel,
    attribute: fact.attribute,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    scope: fact.scope,
    modules: [...fact.modules],
    installationId: fact.installationId,
    status: fact.status,
    sourceKind: fact.sourceKind,
    trust: fact.trust,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    proposalKind: fact.proposalKind,
    evidence: fact.evidence.map((item) => toFactEvidenceType(item)),
    proposedBy: fact.proposedBy,
    proposedAt: fact.proposedAt,
    decidedBy: fact.decidedBy,
    decidedAt: fact.decidedAt,
    decisionNote: fact.decisionNote,
})
