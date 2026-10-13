import type { FactRecord, Instant } from "./brain-facts.contracts"
import type { BrainFactRow } from "./persistence/brain-facts.rows"

/** An instant as ISO text, whether the driver gave a Date or text. */
export const isoOf = (value: Instant): string => (value instanceof Date ? value.toISOString() : value)

/** An optional instant as ISO text. */
const maybeIso = (value: Instant | null): string | null => (value === null ? null : isoOf(value))

/** A fact as the callers read it, from the row the database answers. */
export const toFactRecord = (row: BrainFactRow): FactRecord => ({
    id: row.id,
    subjectType: row.subject_type,
    subjectKey: row.subject_key,
    subjectLabel: row.subject_label,
    attribute: row.attribute,
    attributeLabel: row.attribute_label,
    value: row.value,
    valueNumber: row.value_number === null ? null : Number(row.value_number),
    unit: row.unit,
    scope: row.scope,
    modules: row.modules ?? [],
    installationId: row.installation_id,
    status: row.status,
    sourceKind: row.source_kind,
    trust: row.trust,
    validFrom: maybeIso(row.valid_from),
    validTo: maybeIso(row.valid_to),
    supersedesId: row.supersedes_id,
    conflictWith: row.conflict_with,
    proposalKind: row.proposal_kind ?? "set",
    evidence: row.evidence ?? [],
    proposedBy: row.proposed_by,
    proposedAt: isoOf(row.proposed_at),
    decidedBy: row.decided_by,
    decidedAt: maybeIso(row.decided_at),
    decisionNote: row.decision_note,
})
