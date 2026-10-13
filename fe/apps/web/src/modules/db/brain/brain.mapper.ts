import type { Json } from "../../../../../../../supabase/types/database.types"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type {
    BrainEvidence,
    BrainExtraction,
    BrainFact,
    BrainGap,
    BrainLens,
    BrainLesson,
    FactSource,
    FactState,
    FactScope,
} from "@/modules/types"

const SCOPES: ReadonlyArray<FactScope> = ["public", "internal", "restricted"]
const STATUSES: ReadonlyArray<FactState> = ["proposed", "scheduled", "active", "superseded", "rejected", "expired"]
const SOURCES: ReadonlyArray<FactSource> = ["owner", "manager", "document", "system", "staff", "customer", "ai"]

/** One fact row as the reader selects it. */
export interface FactRow {
    readonly id: string
    readonly subject_type: string
    readonly subject_key: string
    readonly subject_label: string
    readonly attribute: string
    readonly attribute_label: string
    readonly value: string
    readonly unit: string | null
    readonly scope: string
    readonly modules: ReadonlyArray<string>
    readonly installation_id: string | null
    readonly status: string
    readonly source_kind: string
    readonly trust: number
    readonly valid_from: string | null
    readonly valid_to: string | null
    readonly proposal_kind: string
    readonly evidence: Json
    readonly proposed_by: string
    readonly proposed_at: string
    readonly decided_by: string | null
    readonly decided_at: string | null
}

/** The columns of a fact the page reads. */
export const FACT_COLUMNS =
    "id, subject_type, subject_key, subject_label, attribute, attribute_label, value, unit, scope, modules, installation_id, status, source_kind, trust, valid_from, valid_to, proposal_kind, evidence, proposed_by, proposed_at, decided_by, decided_at"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The evidence list of a stored json value; entries without a kind, a reference and a label are dropped. */
export const toEvidence = (value: Json): ReadonlyArray<BrainEvidence> => {
    if (!Array.isArray(value)) return []
    return value.flatMap((item): ReadonlyArray<BrainEvidence> => {
        if (!isRecord(item)) return []
        const kind = textOf(item.kind)
        const ref = textOf(item.ref)
        const label = textOf(item.label)
        if (kind === undefined || ref === undefined || label === undefined) return []
        const quote = textOf(item.quote)
        const at = textOf(item.at)
        return [{ kind, ref, label, ...(quote === undefined ? {} : { quote }), ...(at === undefined ? {} : { at }) }]
    })
}

/** The fact a row stands for. */
export const toFact = (row: FactRow): BrainFact => ({
    id: row.id,
    subjectType: FACT_SUBJECT_TYPES.find((known) => known === row.subject_type) ?? "other",
    subjectKey: row.subject_key,
    subjectLabel: row.subject_label,
    attribute: row.attribute,
    attributeLabel: row.attribute_label,
    value: row.value,
    unit: row.unit,
    scope: SCOPES.find((known) => known === row.scope) ?? "internal",
    modules: row.modules,
    installationId: row.installation_id,
    status: STATUSES.find((known) => known === row.status) ?? "proposed",
    sourceKind: SOURCES.find((known) => known === row.source_kind) ?? "ai",
    trust: row.trust,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    proposalKind: row.proposal_kind === "retire" ? "retire" : "set",
    evidence: toEvidence(row.evidence),
    proposedBy: row.proposed_by,
    proposedAt: row.proposed_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
})

/** One lesson row as the reader selects it. */
export interface LessonRow {
    readonly id: string
    readonly module: string | null
    readonly title: string
    readonly body: string
    readonly applies_when: string
    readonly status: string
    readonly evidence: Json
}

/** The columns of a lesson the page reads. */
export const LESSON_COLUMNS = "id, module, title, body, applies_when, status, evidence"

const LESSON_STATUSES: ReadonlyArray<BrainLesson["status"]> = ["proposed", "active", "retired", "rejected"]

/** The lesson a row stands for. */
export const toLesson = (row: LessonRow): BrainLesson => ({
    id: row.id,
    module: row.module,
    title: row.title,
    body: row.body,
    appliesWhen: row.applies_when,
    status: LESSON_STATUSES.find((known) => known === row.status) ?? "proposed",
    evidence: toEvidence(row.evidence),
})

/** One gap row as the reader selects it. */
export interface GapRow {
    readonly id: string
    readonly module: string
    readonly question: string
    readonly topic: string | null
    readonly attribute_guess: string | null
    readonly count: number
    readonly last_seen_at: string
    readonly reopened_count: number
}

/** The columns of a gap the page reads. */
export const GAP_COLUMNS = "id, module, question, topic, attribute_guess, count, last_seen_at, reopened_count"

/** The gap a row stands for. */
export const toGap = (row: GapRow): BrainGap => ({
    id: row.id,
    module: row.module,
    question: row.question,
    topic: row.topic,
    attributeGuess: row.attribute_guess,
    count: row.count,
    lastSeenAt: row.last_seen_at,
    reopenedCount: row.reopened_count,
})

const EXTRACTION_STATUSES: ReadonlyArray<BrainExtraction["status"]> = [
    "queued",
    "running",
    "done",
    "failed",
    "blocked_credits",
]

/** One reading of a document as the table keeps it. */
interface ExtractionRow {
    readonly source_id: string
    readonly status: string
}

/** The extraction a row stands for. */
export const toExtraction = (row: ExtractionRow): BrainExtraction => ({
    sourceId: row.source_id,
    status: EXTRACTION_STATUSES.find((known) => known === row.status) ?? "queued",
})

/** One agent as the table keeps it. */
interface AgentRow {
    readonly module: string
    readonly name: string
}

/** The lens of an agent row; an agent of a module outside the catalogue has none. */
export const toLens = (row: AgentRow): ReadonlyArray<BrainLens> =>
    isModuleKey(row.module)
        ? [{ module: row.module, name: row.name, audience: MODULE_REGISTRY[row.module].audience }]
        : []
