import type { FindingKind, FindingSeverity, ReviewStatus } from "./dossier-review.contracts"
import type { PackRequirement } from "./dossier-inputs.contracts"

/** What the status of a dossier is computed from. */
export interface StatusFacts {
    /** The pack requirement, or null when the pack has no entry for it. */
    readonly requirement: PackRequirement | null
    /** The status the imported checklist gave it. */
    readonly checklistStatus: ReviewStatus
    /** Actual documents held. */
    readonly actual: number
    /** Drafts held. */
    readonly drafts: number
    /** The open and confirmed findings. */
    readonly active: ReadonlyArray<{ readonly kind: FindingKind; readonly severity: FindingSeverity }>
}

const DEMOTING: ReadonlySet<FindingSeverity> = new Set(["critical", "high", "medium"])

/** The status a review gives a dossier: template, missing (or the checklist's word for an optional one), drafted, partial, or present. */
export const statusOf = (facts: StatusFacts): ReviewStatus => {
    if (facts.requirement === "template" || (facts.requirement === null && facts.checklistStatus === "template")) {
        return "template"
    }
    if (facts.actual === 0 && facts.drafts === 0) {
        return facts.requirement === "optional" ? facts.checklistStatus : "missing"
    }
    if (facts.actual === 0) return "drafted"
    if (facts.active.some((finding) => finding.kind !== "unsigned" && DEMOTING.has(finding.severity))) {
        return "partial"
    }
    return facts.active.some((finding) => finding.kind === "unsigned") ? "drafted" : "present"
}
