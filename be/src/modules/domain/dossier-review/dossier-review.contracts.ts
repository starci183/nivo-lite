/** What is wrong with a document, as the rows of `dossier_findings` name it. */
export const FINDING_KINDS = ["contradiction", "missing", "expired", "unsigned", "outdated", "unreasonable"] as const
/** One of the finding kinds. */
export type FindingKind = (typeof FINDING_KINDS)[number]

/** How much a finding matters. */
export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const
/** One of the severities. */
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

/** The part an evidence item plays in a finding. */
export const EVIDENCE_ROLES = ["claim", "counter", "expected", "event", "context"] as const
/** One of the evidence roles. */
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number]

/** What a job's one effect did: carried out, or skipped because there was nothing to do. */
export type JobOutcome = "done" | "skipped"

/** The error a run takes when its job failed for good. */
export const JOB_FAILED = "job_failed"

/** The bounds of a run and of a stored point, named once. */
export const DOSSIER_REVIEW_CAPS = {
    staleRunMinutes: 15,
    evidenceMax: 8,
    titleMax: 200,
    detailMax: 1_000,
    quoteMax: 300,
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
     * What the place of the passage counts (page, slide or sheet), read from the stored passage when a point is listed; absent in
     * stored evidence, and absent for a passage stored before places or one the file names no place for.
     */
    readonly placeKind?: string | null
    /** The page or slide number, or the sheet name, with the kind. */
    readonly placeLabel?: string | null
    /** The model-free hash of the passage (`passageTextHashOf`), stored by the shop-document critic: a passage keeps it across re-uploads, its id does not. */
    readonly chunkHash?: string | null
}
