import type {
    BrainEvidenceType,
    BrainExtractionType,
    BrainFactType,
    BrainGapType,
    BrainLensType,
    BrainLessonType,
} from "@/modules/api"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type {
    BrainEvidence,
    BrainExtraction,
    BrainFact,
    BrainGap,
    BrainLens,
    BrainLesson,
    FactScope,
    FactSource,
    FactState,
} from "@/modules/types"

const SCOPES: ReadonlyArray<FactScope> = ["public", "internal", "restricted"]
const STATUSES: ReadonlyArray<FactState> = ["proposed", "scheduled", "active", "superseded", "rejected", "expired"]
const SOURCES: ReadonlyArray<FactSource> = ["owner", "manager", "document", "system", "staff", "customer", "ai"]
const LESSON_STATUSES: ReadonlyArray<BrainLesson["status"]> = ["proposed", "active", "retired", "rejected"]
const EXTRACTION_STATUSES: ReadonlyArray<BrainExtraction["status"]> = [
    "queued",
    "running",
    "done",
    "failed",
    "blocked_credits",
]

/** One piece of evidence a wire fact or lesson carries. */
export const toBrainEvidence = (row: BrainEvidenceType): BrainEvidence => ({
    kind: row.kind,
    ref: row.ref,
    label: row.label,
    ...(row.quote === null ? {} : { quote: row.quote }),
    ...(row.at === null ? {} : { at: row.at }),
})

/** The fact a `brain` fact item stands for. */
export const toBrainFact = (row: BrainFactType): BrainFact => ({
    id: row.id,
    subjectType: FACT_SUBJECT_TYPES.find((known) => known === row.subjectType) ?? "other",
    subjectKey: row.subjectKey,
    subjectLabel: row.subjectLabel,
    attribute: row.attribute,
    attributeLabel: row.attributeLabel,
    value: row.value,
    unit: row.unit ?? null,
    scope: SCOPES.find((known) => known === row.scope) ?? "internal",
    modules: row.modules,
    installationId: row.installationId ?? null,
    status: STATUSES.find((known) => known === row.status) ?? "proposed",
    sourceKind: SOURCES.find((known) => known === row.sourceKind) ?? "ai",
    trust: row.trust ?? 0,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    proposalKind: row.proposalKind === "retire" ? "retire" : "set",
    evidence: row.evidence.map(toBrainEvidence),
    proposedBy: row.proposedBy,
    proposedAt: row.proposedAt,
    decidedBy: row.decidedBy ?? null,
    decidedAt: row.decidedAt ?? null,
})

/** The lesson a `brain` lesson item stands for. */
export const toBrainLesson = (row: BrainLessonType): BrainLesson => ({
    id: row.id,
    module: row.module ?? null,
    title: row.title,
    body: row.body,
    appliesWhen: row.appliesWhen,
    status: LESSON_STATUSES.find((known) => known === row.status) ?? "proposed",
    evidence: row.evidence.map(toBrainEvidence),
})

/** The question a `brain` gap item stands for. */
export const toBrainGap = (row: BrainGapType): BrainGap => ({
    id: row.id,
    module: row.module,
    question: row.question,
    topic: row.topic ?? null,
    attributeGuess: row.attributeGuess ?? null,
    count: row.count,
    lastSeenAt: row.lastSeenAt,
    reopenedCount: row.reopenedCount,
})

/** The lens a `brain` lens item stands for. */
export const toBrainLens = (row: BrainLensType): BrainLens => ({
    module: row.module,
    name: row.name,
    audience: row.audience === "internal" ? "internal" : "customer",
})

/** The reading a `brain` extraction item stands for. */
export const toBrainExtraction = (row: BrainExtractionType): BrainExtraction => ({
    sourceId: row.sourceId,
    status: EXTRACTION_STATUSES.find((known) => known === row.status) ?? "queued",
})
