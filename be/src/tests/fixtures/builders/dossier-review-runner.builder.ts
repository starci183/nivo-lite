import { builder } from "@starci/jest-preset"
import { dossierReviewEntities } from "@modules/domain/dossier-review"

const [DossierReviewRunEntity, DossierFindingEntity, DossierReviewEntity] = dossierReviewEntities
type DossierReviewRunEntity = InstanceType<typeof DossierReviewRunEntity>
type DossierFindingEntity = InstanceType<typeof DossierFindingEntity>
type DossierReviewEntity = InstanceType<typeof DossierReviewEntity>

/** The workspace the review rows belong to. */
export const REVIEW_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** The instant the specs run at. */
export const REVIEW_NOW = "2026-10-31T10:00:00.000Z"

const EARLIER = new Date("2026-10-01T00:00:00.000Z")

/** A queued review run of dossier d1, asked for by a document. */
export const reviewRunOf = builder<DossierReviewRunEntity>({
    id: "r1",
    workspaceId: REVIEW_WORKSPACE,
    scope: "dossier",
    dossierId: "d1",
    trigger: "document",
    triggerRef: null,
    status: "queued",
    requestedBy: null,
    aiState: null,
    stats: {},
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(REVIEW_NOW),
    updatedAt: new Date(REVIEW_NOW),
})

/** A run of dossier d1 in a status, claimed at an instant or never. */
export const runInState = (status: DossierReviewRunEntity["status"], startedAt: Date | null): DossierReviewRunEntity =>
    reviewRunOf({ status, startedAt })

/** A run of the whole set in a status, claimed at an instant or never. */
export const workspaceRunOf = (
    status: DossierReviewRunEntity["status"] = "queued",
    startedAt: Date | null = null,
): DossierReviewRunEntity => reviewRunOf({ scope: "workspace", dossierId: null, status, startedAt })

/** An open model finding of dossier d1 citing source s1, first seen a month before the specs run. */
export const storedFindingOf = builder<DossierFindingEntity>({
    id: "f1",
    workspaceId: REVIEW_WORKSPACE,
    dossierId: "d1",
    relatedDossierIds: [],
    kind: "missing",
    severity: "medium",
    origin: "ai",
    ruleKey: "ai",
    fingerprint: "fp-ai",
    code: null,
    params: {},
    title: "Old",
    detail: "Old detail",
    evidence: [],
    evidenceHash: "h",
    sourceIds: ["s1"],
    factIds: [],
    remedyAction: "upload",
    remedyDocumentType: null,
    status: "open",
    resolution: null,
    dismissReason: null,
    dismissedEvidenceHash: null,
    reopenedCount: 0,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    assigneeId: null,
    dueAt: null,
    firstSeenRunId: null,
    lastSeenRunId: null,
    firstSeenAt: EARLIER,
    lastSeenAt: EARLIER,
    resolvedAt: null,
    createdAt: EARLIER,
    updatedAt: EARLIER,
})

/** The stored state of dossier d1 after an earlier run. */
export const dossierReviewOf = builder<DossierReviewEntity>({
    id: "rv-d1",
    workspaceId: REVIEW_WORKSPACE,
    dossierId: "d1",
    status: "partial",
    openCount: 0,
    criticalCount: 0,
    highCount: 0,
    actualDocuments: 1,
    draftDocuments: 0,
    templateDocuments: 0,
    inputsFingerprint: null,
    lastRunId: null,
    reviewedAt: new Date(REVIEW_NOW),
    createdAt: new Date(REVIEW_NOW),
    updatedAt: new Date(REVIEW_NOW),
})

/** The stored findings of dossier d1 a model pass re-judges: an open and a confirmed model finding, a dismissed one and a rule finding. */
export const mixedStoredFindings = (): ReadonlyArray<DossierFindingEntity> => [
    storedFindingOf(),
    storedFindingOf({ id: "f2", fingerprint: "fp-confirmed", status: "confirmed", title: "Kept" }),
    storedFindingOf({ id: "f3", fingerprint: "fp-gone", status: "dismissed", dismissReason: "no" }),
    storedFindingOf({ id: "f4", fingerprint: "fp-rule", origin: "rule", ruleKey: "presence.expected" }),
]
