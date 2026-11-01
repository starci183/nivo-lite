import type { Connection } from "@modules/platform/pagination"

/** What is wrong with a dossier. */
export const FINDING_KINDS = ["contradiction", "missing", "expired", "unsigned", "outdated", "unreasonable"] as const
/** One of the finding kinds. */
export type FindingKind = (typeof FINDING_KINDS)[number]

/** How much a finding matters; only critical, high and medium findings demote a dossier. */
export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const
/** One of the severities. */
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

/** The severities a model finding may take: never critical. */
export const AI_SEVERITIES = ["high", "medium", "low"] as const

/** Who produced a finding. */
export const FINDING_ORIGINS = ["rule", "ai"] as const
/** One of the origins. */
export type FindingOrigin = (typeof FINDING_ORIGINS)[number]

/** The lifecycle states of a finding. */
export const FINDING_STATUSES = ["open", "confirmed", "dismissed", "resolved"] as const
/** One of the finding statuses. */
export type FindingStatus = (typeof FINDING_STATUSES)[number]

/** Why a finding is resolved. */
export const FINDING_RESOLUTIONS = ["document", "draft", "not_detected", "manual"] as const
/** One of the resolutions. */
export type FindingResolution = (typeof FINDING_RESOLUTIONS)[number]

/** What completes a finding. */
export const REMEDY_ACTIONS = ["upload", "draft", "decide", "external"] as const
/** One of the remedy actions. */
export type RemedyAction = (typeof REMEDY_ACTIONS)[number]

/** The part an evidence item plays in a finding. */
export const EVIDENCE_ROLES = ["claim", "counter", "expected", "event", "context"] as const
/** One of the evidence roles. */
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number]

/** Whether a run covers one dossier or the whole set. */
export const RUN_SCOPES = ["dossier", "workspace"] as const
/** What asked for a run. */
export const RUN_TRIGGERS = ["document", "document_gone", "request"] as const
/** Where a run stands. */
export const RUN_STATUSES = ["queued", "running", "done", "failed"] as const
/** What the model pass of a run did. */
export const AI_STATES = [
    "done",
    "partial",
    "skipped_unchanged",
    "skipped_credits",
    "skipped_budget",
    "failed",
] as const
/** One of the AI states. */
export type AiState = (typeof AI_STATES)[number]
/** Where a remedy draft stands. */
export const DRAFT_STATUSES = ["generating", "proposed", "approved", "rejected", "failed"] as const
/** One of the draft statuses. */
export type DraftStatus = (typeof DRAFT_STATUSES)[number]
/** The recomputed status of a dossier. */
export const REVIEW_STATUSES = ["present", "partial", "drafted", "missing", "template"] as const
/** One of the review statuses. */
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

const KIND_SET: ReadonlySet<string> = new Set(FINDING_KINDS)
const SEVERITY_SET: ReadonlySet<string> = new Set(FINDING_SEVERITIES)
const REMEDY_SET: ReadonlySet<string> = new Set(REMEDY_ACTIONS)

/** True when a text is one of the finding kinds. */
export const isFindingKind = (value: string): value is FindingKind => KIND_SET.has(value)

/** True when a text is one of the severities. */
export const isFindingSeverity = (value: string): value is FindingSeverity => SEVERITY_SET.has(value)

/** True when a text is one of the remedy actions. */
export const isRemedyAction = (value: string): value is RemedyAction => REMEDY_SET.has(value)

/** The version of the rule pack; it enters every inputs fingerprint. */
export const DOSSIER_REVIEW_PACK_VERSION = "vn-llc-64@1"
/** The version of the review prompt; it enters every inputs fingerprint. */
export const DOSSIER_REVIEW_PROMPT_VERSION = "dossier-review@1"

/** What a job's one effect did: carried out, or skipped because there was nothing to do. */
export type JobOutcome = "done" | "skipped"

/** The dossier a review run is about, or null for the whole workspace. */
export type ReviewDossierId = string | null

/** A text people may leave out. */
export type OptionalText = string | null

/** The error a run or a draft takes when its job failed for good. */
export const JOB_FAILED = "job_failed"

/** The bounds of the review, named once. */
export const DOSSIER_REVIEW_CAPS = {
    bundleChars: 24_000,
    documents: 12,
    documentChars: 3_000,
    passageChars: 1_200,
    dossierFacts: 120,
    relatedFacts: 60,
    findingsPerCall: 8,
    callTimeoutMs: 60_000,
    workspaceCalls: 80,
    workspacePromptTokens: 600_000,
    dailyReviewCalls: 150,
    dailyRemedyDrafts: 30,
    remedyPromptChars: 16_000,
    remedyBodyChars: 40_000,
    remedyTimeoutMs: 90_000,
    staleRunMinutes: 15,
    evidenceMax: 8,
    expiringDays: 60,
    contributionDays: 90,
    knownMax: 40,
    openAiMax: 20,
    titleMax: 200,
    detailMax: 1_000,
    quoteMax: 300,
    dayMs: 86_400_000,
} as const

/** One evidence item of a finding. */
export interface FindingEvidence {
    /** The part it plays. */
    readonly role: EvidenceRole
    /** A short label for people. */
    readonly label: string
    /** The document it comes from. */
    readonly sourceId: string | null
    /** That document's title. */
    readonly sourceTitle: string | null
    /** The passage it comes from. */
    readonly passageId: string | null
    /** The fact it comes from. */
    readonly factId: string | null
    /** The fact as a line of text. */
    readonly factLine: string | null
    /** The words, copied verbatim. */
    readonly quote: string | null
    /**
     * What the place of the passage counts (page, slide or sheet), read from the stored passage when a finding is listed; absent in
     * stored evidence, and absent for a passage stored before places or one the file names no place for.
     */
    readonly placeKind?: string | null
    /** The page or slide number, or the sheet name, with the kind. */
    readonly placeLabel?: string | null
}

/** A message param as the API lists it. */
export interface FindingParam {
    /** The name. */
    readonly name: string
    /** The value. */
    readonly value: string
}

/** A finding as the doors read it, shaped like the GraphQL type. */
export interface FindingRecord {
    /** The finding id. */
    readonly id: string
    /** The dossier it is filed under. */
    readonly dossierId: string | null
    /** That dossier's reference. */
    readonly dossierRef: string | null
    /** That dossier's name. */
    readonly dossierName: string | null
    /** The other dossiers it touches. */
    readonly relatedDossierIds: ReadonlyArray<string>
    /** What is wrong. */
    readonly kind: FindingKind
    /** How much it matters. */
    readonly severity: FindingSeverity
    /** Rule or model. */
    readonly origin: FindingOrigin
    /** The message code of a rule finding. */
    readonly code: string | null
    /** The message params. */
    readonly params: ReadonlyArray<FindingParam>
    /** The title, rendered in the locale of the request for a rule finding. */
    readonly title: string
    /** The detail, rendered likewise. */
    readonly detail: string
    /** The evidence. */
    readonly evidence: ReadonlyArray<FindingEvidence>
    /** What completes it. */
    readonly remedyAction: RemedyAction
    /** The kind of document that completes it. */
    readonly remedyDocumentType: string | null
    /** Its lifecycle state. */
    readonly status: FindingStatus
    /** Why it is resolved. */
    readonly resolution: FindingResolution | null
    /** Why it was dismissed. */
    readonly dismissReason: string | null
    /** The note of the last decision. */
    readonly decisionNote: string | null
    /** How many times it came back. */
    readonly reopenedCount: number
    /** The member who owns it. */
    readonly assigneeId: string | null
    /** The due date, YYYY-MM-DD. */
    readonly dueAt: string | null
    /** The live draft answering it. */
    readonly draftId: string | null
    /** That draft's status. */
    readonly draftStatus: DraftStatus | null
    /** When it was first seen, ISO 8601. */
    readonly firstSeenAt: string
    /** When it was last seen. */
    readonly lastSeenAt: string
    /** When it was resolved. */
    readonly resolvedAt: string | null
    /** When it was last decided. */
    readonly decidedAt: string | null
    /** When the row was created. */
    readonly createdAt: string
    /** When the row last changed. */
    readonly updatedAt: string
}

/** One page of findings. */
export type FindingPage = Connection<FindingRecord>

/** Which findings a list returns. */
export interface FindingFilter {
    /** The page size. */
    readonly first?: number | null | undefined
    /** The cursor of the previous page. */
    readonly after?: string | null | undefined
    /** Only this dossier. */
    readonly dossierId?: string | null | undefined
    /** Only these statuses. */
    readonly statuses?: ReadonlyArray<string> | null | undefined
    /** Only these severities. */
    readonly severities?: ReadonlyArray<string> | null | undefined
    /** Only this assignee. */
    readonly assigneeId?: string | null | undefined
    /** Only findings nobody owns. */
    readonly unassigned?: boolean | null | undefined
    /** Only findings with a draft waiting for approval. */
    readonly draftsAwaiting?: boolean | null | undefined
}

/** A run as the doors read it. */
export interface ReviewRunRecord {
    /** The run id. */
    readonly id: string
    /** dossier or workspace. */
    readonly scope: string
    /** The dossier of a dossier run. */
    readonly dossierId: string | null
    /** What asked for it. */
    readonly trigger: string
    /** Where it stands. */
    readonly status: string
    /** What the model pass did. */
    readonly aiState: string | null
    /** Findings opened. */
    readonly opened: number
    /** Findings resolved. */
    readonly resolved: number
    /** Candidates dropped by the evidence check. */
    readonly dropped: number
    /** When a worker claimed it. */
    readonly startedAt: string | null
    /** When it ended. */
    readonly finishedAt: string | null
    /** When it was requested. */
    readonly createdAt: string
}

/** The recomputed state of one dossier. */
export interface DossierReviewRecord {
    /** The dossier id. */
    readonly dossierId: string
    /** The recomputed status. */
    readonly status: ReviewStatus
    /** The status of the imported checklist. */
    readonly checklistStatus: string
    /** Active findings. */
    readonly openCount: number
    /** Active critical findings. */
    readonly criticalCount: number
    /** Active high findings. */
    readonly highCount: number
    /** When it was reviewed, ISO 8601. */
    readonly reviewedAt: string
}

/** The review at a glance. */
export interface ReviewSummary {
    /** Open findings. */
    readonly open: number
    /** Confirmed findings. */
    readonly confirmed: number
    /** Active critical findings. */
    readonly critical: number
    /** Active high findings. */
    readonly high: number
    /** Drafts waiting for approval. */
    readonly draftsAwaiting: number
    /** Whether a run is queued or running. */
    readonly isRunning: boolean
    /** The newest run. */
    readonly latestRun: ReviewRunRecord | null
    /** The reviewed dossiers. */
    readonly dossiers: ReadonlyArray<DossierReviewRecord>
}

/** A draft as the doors read it. */
export interface RemedyDraftRecord {
    /** The draft id. */
    readonly id: string
    /** The finding it answers. */
    readonly findingId: string
    /** That finding's dossier. */
    readonly dossierId: string | null
    /** Where it stands. */
    readonly status: DraftStatus
    /** The title. */
    readonly title: string
    /** The kind of document. */
    readonly documentType: string
    /** The Markdown text. */
    readonly body: string
    /** What is left to fill in. */
    readonly placeholders: ReadonlyArray<{ readonly label: string; readonly reason: string }>
    /** The error code of a failed draft. */
    readonly error: string | null
    /** The source an approved draft became. */
    readonly sourceId: string | null
    /** What the owner asked. */
    readonly instructions: string | null
    /** Why it was rejected. */
    readonly rejectReason: string | null
    /** When it was decided. */
    readonly decidedAt: string | null
    /** When it was requested. */
    readonly createdAt: string
    /** When it last changed. */
    readonly updatedAt: string
}

/** A draft, or null when there is none. */
export type MaybeRemedyDraft = RemedyDraftRecord | null

/** Confirming a finding. */
export interface ConfirmFindingInput {
    /** The finding. */
    readonly findingId: string
    /** An optional note. */
    readonly note?: string | null | undefined
}

/** Dismissing a finding. */
export interface DismissFindingInput {
    /** The finding. */
    readonly findingId: string
    /** Why, 3 to 500 characters. */
    readonly reason: string
}

/** Reopening a finding. */
export interface ReopenFindingInput {
    /** The finding. */
    readonly findingId: string
}

/** Marking a finding done by hand. */
export interface ResolveFindingInput {
    /** The finding. */
    readonly findingId: string
    /** What was done, 3 to 500 characters. */
    readonly note: string
}

/** Giving a finding to a member. */
export interface AssignFindingInput {
    /** The finding. */
    readonly findingId: string
    /** The member, or null to unassign. */
    readonly assigneeId: string | null
    /** The due date YYYY-MM-DD, or null. */
    readonly dueAt: string | null
}

/** Saving the edits of a draft. */
export interface SaveDraftInput {
    /** The draft. */
    readonly draftId: string
    /** The new title. */
    readonly title: string
    /** The new body. */
    readonly body: string
}
