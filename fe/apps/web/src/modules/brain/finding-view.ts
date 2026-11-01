import type { EvidenceItemView } from "./finding-row"
import { DOSSIER_STATUS_ORDER } from "./dossiers"
import type { DossierStatus } from "./dossiers"
import {
    FINDING_KINDS,
    FINDING_RESOLUTIONS,
    FINDING_SEVERITIES,
    FINDING_STATUSES,
    REMEDY_ACTIONS,
    REMEDY_DRAFT_STATUSES,
    EVIDENCE_PLACE_KINDS,
} from "./findings"
import type {
    EvidencePlaceKind,
    FindingKind,
    FindingResolution,
    FindingSeverity,
    FindingStatus,
    RemedyAction,
    RemedyDraftStatus,
} from "./findings"

/** Where in its document a quote sits: the page of a PDF, the slide of a presentation or the sheet of a workbook. */
export interface EvidencePlaceView {
    readonly kind: EvidencePlaceKind
    /** The page or slide number, or the sheet name. */
    readonly label: string
}

/** The evidence of a finding that a reader can follow back to a document or a fact. */
export interface FindingEvidenceView {
    readonly role: string
    readonly label: string
    readonly sourceId: string | null
    readonly sourceTitle: string | null
    readonly factLine: string | null
    readonly quote: string | null
    /** Where the quote sits in its document; null for a quote stored before places and for a file with none. */
    readonly place: EvidencePlaceView | null
}

/** A finding as the back end `dossierFindings` query answers it. */
export interface FindingRecord {
    readonly id: string
    readonly dossierId?: string | null | undefined
    readonly dossierRef?: string | null | undefined
    readonly dossierName?: string | null | undefined
    readonly kind: string
    readonly severity: string
    readonly origin: string
    readonly title: string
    readonly detail: string
    readonly evidence: ReadonlyArray<{
        readonly role: string
        readonly label: string
        readonly sourceId?: string | null | undefined
        readonly sourceTitle?: string | null | undefined
        readonly factLine?: string | null | undefined
        readonly quote?: string | null | undefined
        readonly placeKind?: string | null | undefined
        readonly placeLabel?: string | null | undefined
    }>
    readonly remedyAction: string
    readonly remedyDocumentType?: string | null | undefined
    readonly status: string
    readonly resolution?: string | null | undefined
    readonly dismissReason?: string | null | undefined
    readonly decisionNote?: string | null | undefined
    readonly assigneeId?: string | null | undefined
    readonly dueAt?: string | null | undefined
    readonly draftId?: string | null | undefined
    readonly draftStatus?: string | null | undefined
    readonly lastSeenAt: string
    readonly resolvedAt?: string | null | undefined
    readonly decidedAt?: string | null | undefined
}

/** A finding, typed for the screens: every closed set is a union, every absent value is null. */
export interface FindingView {
    readonly id: string
    readonly dossierId: string | null
    readonly dossierRef: string | null
    readonly dossierName: string | null
    readonly kind: FindingKind
    readonly severity: FindingSeverity
    readonly isAi: boolean
    readonly title: string
    readonly detail: string
    readonly evidence: ReadonlyArray<FindingEvidenceView>
    readonly remedyAction: RemedyAction
    readonly status: FindingStatus
    readonly resolution: FindingResolution | null
    readonly note: string | null
    readonly assigneeId: string | null
    readonly dueAt: string | null
    readonly draftId: string | null
    readonly draftStatus: RemedyDraftStatus | null
}

/** The member of a closed set that a value from the back end names; undefined when the set does not hold it. */
const oneOf = <T extends string>(set: ReadonlyArray<T>, value: string): T | undefined =>
    set.find((one) => one === value)

/** The value of an optional field that is only meaningful when it names one of a closed set. */
const orNull = <T extends string>(set: ReadonlyArray<T>, value: string | null | undefined): T | null =>
    (value === null || value === undefined ? undefined : oneOf(set, value)) ?? null

/** The place a quote sits at; null unless the back end names a known kind and a label. */
const placeOf = (kind: string | null | undefined, label: string | null | undefined): EvidencePlaceView | null => {
    const known = orNull(EVIDENCE_PLACE_KINDS, kind)
    return known === null || label === null || label === undefined || label === "" ? null : { kind: known, label }
}

/** The day part of an instant or date the back end sends; null when absent. */
const dayOf = (value: string | null | undefined): string | null =>
    value === null || value === undefined || value === "" ? null : value.slice(0, 10)

/** The note a reader sees under a closed finding: the reason it was dismissed, else what was decided when it was done. */
const noteOf = (record: FindingRecord): string | null => {
    const note = record.status === "dismissed" ? record.dismissReason : record.decisionNote
    return note === null || note === undefined || note.trim() === "" ? null : note
}

/** A finding for the screens; undefined when the back end names a kind, severity, status or remedy this app does not know. */
export const findingViewOf = (record: FindingRecord): FindingView | undefined => {
    const kind = oneOf(FINDING_KINDS, record.kind)
    const severity = oneOf(FINDING_SEVERITIES, record.severity)
    const status = oneOf(FINDING_STATUSES, record.status)
    const remedyAction = oneOf(REMEDY_ACTIONS, record.remedyAction)
    if (kind === undefined || severity === undefined || status === undefined || remedyAction === undefined)
        return undefined
    return {
        id: record.id,
        dossierId: record.dossierId ?? null,
        dossierRef: record.dossierRef ?? null,
        dossierName: record.dossierName ?? null,
        kind,
        severity,
        isAi: record.origin === "ai",
        title: record.title,
        detail: record.detail,
        evidence: record.evidence.map((one) => ({
            role: one.role,
            label: one.label,
            sourceId: one.sourceId ?? null,
            sourceTitle: one.sourceTitle ?? null,
            factLine: one.factLine ?? null,
            quote: one.quote ?? null,
            place: placeOf(one.placeKind, one.placeLabel),
        })),
        remedyAction,
        status,
        resolution: orNull(FINDING_RESOLUTIONS, record.resolution),
        note: noteOf(record),
        assigneeId: record.assigneeId ?? null,
        dueAt: dayOf(record.dueAt),
        draftId: record.draftId ?? null,
        draftStatus: orNull(REMEDY_DRAFT_STATUSES, record.draftStatus),
    }
}

/** What the review computed for one dossier, as the back end `dossierReviewSummary` query answers it. */
export interface DossierReviewRecord {
    readonly dossierId: string
    readonly status: string
    readonly checklistStatus: string
    readonly openCount: number
    readonly criticalCount: number
    readonly highCount: number
    readonly reviewedAt: string
}

/** The severity a count badge wears for a dossier: critical, else high, else medium for the rest of its active findings. */
export const worstSeverityOf = (review: DossierReviewRecord): FindingSeverity | null => {
    if (review.criticalCount > 0) return "critical"
    if (review.highCount > 0) return "high"
    return review.openCount > 0 ? "medium" : null
}

/** A member of the workspace, as the back end `workspaceMembers` query answers it. */
export interface MemberRecord {
    readonly userId: string
    readonly displayName: string
    readonly email: string
    readonly status: string
}

/** A person a finding can be given to. */
export interface MemberOption {
    readonly id: string
    readonly label: string
}

/** The active members of the workspace as the options of the assignee list, by name. */
export const memberOptionsOf = (members: ReadonlyArray<MemberRecord>): ReadonlyArray<MemberOption> =>
    members
        .filter((member) => member.status === "active")
        .map((member) => ({
            id: member.userId,
            label: member.displayName.trim() === "" ? member.email : member.displayName,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "vi"))

/** The tag that files a document under a dossier, and the address the existing upload preset carries it by. */
export const dossierTagOf = (ref: string): string => `dossier:${ref}`

/** The status a dossier stands at once the review has looked at it, and the checklist status beside it when the two differ. */
export interface ReviewedStatus {
    readonly status: DossierStatus
    readonly checklist: DossierStatus | null
}

const dossierStatusOf = (value: string | undefined): DossierStatus | undefined =>
    DOSSIER_STATUS_ORDER.find((one) => one === value)

/**
 * Once a dossier has been reviewed, the status the review computed replaces the imported checklist status; the imported one is
 * kept beside it when they differ. A dossier not reviewed yet keeps the imported status.
 */
export const reviewedStatusOf = (imported: string, review: DossierReviewRecord | undefined): ReviewedStatus => {
    const base = dossierStatusOf(imported) ?? "missing"
    const computed = dossierStatusOf(review?.status)
    if (computed === undefined) return { status: base, checklist: null }
    return { status: computed, checklist: computed === base ? null : base }
}

/** A remedy draft as the back end `dossierRemedyDraft` query answers it. */
export interface DraftRecord {
    readonly id: string
    readonly findingId: string
    readonly status: string
    readonly title: string
    readonly documentType: string
    readonly body: string
    readonly placeholders: ReadonlyArray<{ readonly label: string; readonly reason: string }>
    readonly error?: string | null | undefined
    readonly rejectReason?: string | null | undefined
}

/** A remedy draft for the screens. */
export interface DraftView {
    readonly id: string
    readonly findingId: string
    readonly status: RemedyDraftStatus
    readonly title: string
    readonly body: string
    readonly placeholders: ReadonlyArray<EvidenceItemView>
}

/** A draft for the screens; undefined when the back end names a state this app does not know. */
export const draftViewOf = (record: DraftRecord): DraftView | undefined => {
    const status = orNull(REMEDY_DRAFT_STATUSES, record.status)
    if (status === null) return undefined
    return {
        id: record.id,
        findingId: record.findingId,
        status,
        title: record.title,
        body: record.body,
        placeholders: record.placeholders.map((one) => ({ id: one.label, label: one.label, description: one.reason })),
    }
}

/** What a reader can do with a finding, in the order the row offers it. */
export const FINDING_ACTIONS = [
    "confirm",
    "dismiss",
    "assign",
    "upload",
    "askDraft",
    "viewDraft",
    "markDone",
    "reopen",
] as const

/** One of the things a reader can do with a finding. */
export type FindingAction = (typeof FINDING_ACTIONS)[number]

/** Whether a finding still needs somebody. */
export const isActive = (finding: FindingView): boolean => finding.status === "open" || finding.status === "confirmed"

/** A draft that can still be read: written, being written, filed or turned down; a failed one is asked for again. */
const hasDraft = (finding: FindingView): boolean => finding.draftId !== null && finding.draftStatus !== "failed"

/** A draft being written or waiting for a decision: asking for another is refused until it is decided, as the back end does. */
const hasLiveDraft = (finding: FindingView): boolean =>
    finding.draftId !== null && (finding.draftStatus === "generating" || finding.draftStatus === "proposed")

/**
 * The actions a row offers. Everyone who reads may open a draft; owners and managers decide the rest. An active finding can be
 * confirmed (while open), dismissed, given to someone and marked done; a dismissed or resolved one can be reopened. A turned down or failed draft can be asked for again. The upload
 * leads to the document the finding names, and NIVO drafts only what the finding says it can.
 */
export const findingActionsOf = (finding: FindingView, canWrite: boolean): ReadonlyArray<FindingAction> => {
    const viewDraft: ReadonlyArray<FindingAction> = hasDraft(finding) ? ["viewDraft"] : []
    if (!canWrite) return viewDraft
    if (!isActive(finding)) return [...viewDraft, "reopen"]
    const asking: ReadonlyArray<FindingAction> =
        finding.remedyAction === "draft" && !hasLiveDraft(finding) ? ["askDraft"] : []
    const drafting: ReadonlyArray<FindingAction> = [...asking, ...viewDraft]
    return [
        ...(finding.status === "open" ? (["confirm"] as const) : []),
        "dismiss",
        "assign",
        ...(finding.remedyAction === "upload" || finding.remedyAction === "draft" ? (["upload"] as const) : []),
        ...drafting,
        "markDone",
    ]
}
