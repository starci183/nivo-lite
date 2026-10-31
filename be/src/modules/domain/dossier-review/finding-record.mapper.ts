import { isFindingKind, isFindingSeverity, isRemedyAction } from "./dossier-review.contracts"
import type { DossierRef } from "./dossier-inputs.contracts"
import type { DossierReviewRecord, FindingRecord, RemedyDraftRecord, ReviewRunRecord } from "./dossier-review.contracts"
import type {
    DossierFindingEntity,
    DossierRemedyDraftEntity,
    DossierReviewEntity,
    DossierReviewRunEntity,
} from "./persistence/entities"
import { citedIds } from "./fingerprint.policy"
import type { FindingChanges, PreparedCandidate, StoredFinding } from "./reconcile.policy"

const iso = (at: Date | null): string | null => (at === null ? null : at.toISOString())

/** What a finding record adds to its row: the dossier it is filed under, its live draft and its words in the reader's locale. */
export interface FindingExtras {
    /** The dossier's reference and name, when the dossier is known. */
    readonly dossier: Pick<DossierRef, "ref" | "name"> | undefined
    /** The latest draft answering it. */
    readonly draft: Pick<DossierRemedyDraftEntity, "id" | "status"> | undefined
    /** The title and detail people read. */
    readonly text: Pick<FindingRecord, "title" | "detail">
}

/** A finding as the doors read it. */
export const toFindingRecord = (row: DossierFindingEntity, extras: FindingExtras): FindingRecord => ({
    id: row.id,
    dossierId: row.dossierId,
    dossierRef: extras.dossier?.ref ?? null,
    dossierName: extras.dossier?.name ?? null,
    relatedDossierIds: [...row.relatedDossierIds],
    kind: row.kind,
    severity: row.severity,
    origin: row.origin,
    code: row.code,
    params: Object.entries(row.params)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    title: extras.text.title,
    detail: extras.text.detail,
    evidence: [...row.evidence],
    remedyAction: row.remedyAction,
    remedyDocumentType: row.remedyDocumentType,
    status: row.status,
    resolution: row.resolution,
    dismissReason: row.dismissReason,
    decisionNote: row.decisionNote,
    reopenedCount: row.reopenedCount,
    assigneeId: row.assigneeId,
    dueAt: row.dueAt,
    draftId: extras.draft?.id ?? null,
    draftStatus: extras.draft?.status ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: iso(row.resolvedAt),
    decidedAt: iso(row.decidedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

/** A finding as the reconciliation reads it. */
export const toStoredFinding = (row: DossierFindingEntity): StoredFinding => ({
    id: row.id,
    fingerprint: row.fingerprint,
    origin: row.origin,
    ruleKey: row.ruleKey,
    dossierId: row.dossierId,
    status: row.status,
    evidenceHash: row.evidenceHash,
    dismissedEvidenceHash: row.dismissedEvidenceHash,
    reopenedCount: row.reopenedCount,
    remedyAction: row.remedyAction,
})

/** A run as the doors read it. */
export const toRunRecord = (row: DossierReviewRunEntity): ReviewRunRecord => ({
    id: row.id,
    scope: row.scope,
    dossierId: row.dossierId,
    trigger: row.trigger,
    status: row.status,
    aiState: row.aiState,
    opened: row.stats.opened ?? 0,
    resolved: row.stats.resolved ?? 0,
    dropped: row.stats.dropped ?? 0,
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    createdAt: row.createdAt.toISOString(),
})

/** A draft as the doors read it. */
export const toDraftRecord = (row: DossierRemedyDraftEntity): RemedyDraftRecord => ({
    id: row.id,
    findingId: row.findingId,
    dossierId: row.dossierId,
    status: row.status,
    title: row.title,
    documentType: row.documentType,
    body: row.body,
    placeholders: row.placeholders.map((item) => ({ label: item.label, reason: item.reason })),
    error: row.error,
    sourceId: row.sourceId,
    instructions: row.instructions,
    rejectReason: row.rejectReason,
    decidedAt: iso(row.decidedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

/** The recomputed state of a dossier with the status its checklist gave it. */
export const toDossierReviewRecord = (row: DossierReviewEntity, checklistStatus: string): DossierReviewRecord => ({
    dossierId: row.dossierId,
    status: row.status,
    checklistStatus,
    openCount: row.openCount,
    criticalCount: row.criticalCount,
    highCount: row.highCount,
    reviewedAt: row.reviewedAt.toISOString(),
})

const isKind = isFindingKind
const isSeverity = isFindingSeverity
const isRemedy = isRemedyAction

/** Where a new finding was seen. */
export interface FirstSeen {
    /** The workspace. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** The instant of the run. */
    readonly now: Date
}

/** The row of a new finding, or none when the candidate's kind, severity or remedy is outside the enums (the guard drops those first). */
export const toFindingRows = (
    item: PreparedCandidate,
    seen: FirstSeen,
): ReadonlyArray<Partial<DossierFindingEntity>> => {
    const { candidate } = item
    const { kind, severity, remedyAction } = candidate
    if (!isKind(kind) || !isSeverity(severity) || !isRemedy(remedyAction)) return []
    const cited = citedIds(candidate.evidence)
    return [
        {
            workspaceId: seen.workspaceId,
            dossierId: candidate.dossierId,
            relatedDossierIds: [...candidate.relatedDossierIds],
            kind,
            severity,
            origin: candidate.origin,
            ruleKey: candidate.ruleKey,
            fingerprint: item.fingerprint,
            code: candidate.code,
            params: { ...candidate.params },
            title: candidate.title,
            detail: candidate.detail,
            evidence: [...candidate.evidence],
            evidenceHash: item.evidenceHash,
            sourceIds: cited.sources,
            factIds: cited.facts,
            remedyAction,
            remedyDocumentType: candidate.remedyDocumentType,
            firstSeenRunId: seen.runId,
            lastSeenRunId: seen.runId,
            firstSeenAt: seen.now,
            lastSeenAt: seen.now,
        },
    ]
}

/** The columns a reconciliation changes, with the kind, severity and remedy kept only when they are inside the enums. */
export const toFindingUpdate = (changes: FindingChanges): Partial<DossierFindingEntity> => {
    const { kind, severity, remedyAction, ...rest } = changes
    return {
        ...rest,
        ...(kind !== undefined && isKind(kind) ? { kind } : {}),
        ...(severity !== undefined && isSeverity(severity) ? { severity } : {}),
        ...(remedyAction !== undefined && isRemedy(remedyAction) ? { remedyAction } : {}),
    }
}
