import { builder } from "@starci/jest-preset"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import { dossierReviewEntities } from "@modules/domain/dossier-review"
import type { DossierSource } from "@modules/domain/knowledge-sources"
import { entityRowBuilder } from "./entity-row.builder"

const [DossierReviewRunEntity, DossierFindingEntity, DossierReviewEntity, DossierRemedyDraftEntity] =
    dossierReviewEntities
type DossierReviewRunEntity = InstanceType<typeof DossierReviewRunEntity>
type DossierFindingEntity = InstanceType<typeof DossierFindingEntity>
type DossierReviewEntity = InstanceType<typeof DossierReviewEntity>
type DossierRemedyDraftEntity = InstanceType<typeof DossierRemedyDraftEntity>

/** The workspace the rows of the dossier review services belong to. */
export const SERVICES_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** The instant the service specs run at. */
export const SERVICES_NOW = new Date("2026-10-31T10:00:00.000Z")

/** The id of the first finding, UUID-shaped so a page cursor can carry it. */
export const FINDING_ID = "aaaaaaaa-0000-4000-8000-000000000001"

/** The id of the draft the specs work on. */
export const DRAFT_ID = "bbbbbbbb-0000-4000-8000-000000000001"

/** An open rule finding of dossier d1: the document its pack expects is missing. */
export const findingRowOf = entityRowBuilder<DossierFindingEntity>({
    id: FINDING_ID,
    workspaceId: SERVICES_WORKSPACE,
    dossierId: "d1",
    relatedDossierIds: ["d2"],
    kind: "missing",
    severity: "high",
    origin: "rule",
    ruleKey: "presence.expected",
    fingerprint: "fp1",
    code: "presence_expected",
    params: { dossier: "1. Certificate" },
    title: "Stored title",
    detail: "Stored detail",
    evidence: [
        {
            role: "event",
            label: "Transfer",
            sourceId: "s1",
            sourceTitle: "Contract",
            passageId: null,
            factId: "fa",
            factLine: null,
            quote: "17/08/2026",
        },
    ],
    evidenceHash: "h1",
    sourceIds: ["s1"],
    factIds: ["fa"],
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
    firstSeenRunId: "r1",
    lastSeenRunId: "r1",
    firstSeenAt: SERVICES_NOW,
    lastSeenAt: SERVICES_NOW,
    resolvedAt: null,
    createdAt: SERVICES_NOW,
    updatedAt: SERVICES_NOW,
})

/** A generating remedy draft of the first finding, with the owner's instructions. */
export const draftRowOf = entityRowBuilder<DossierRemedyDraftEntity>({
    id: DRAFT_ID,
    workspaceId: SERVICES_WORKSPACE,
    findingId: FINDING_ID,
    dossierId: "d2",
    status: "generating",
    instructions: "Keep it short",
    title: "",
    documentType: "",
    body: "",
    placeholders: [],
    model: null,
    error: null,
    sourceId: null,
    requestedBy: "m1",
    decidedBy: null,
    decidedAt: null,
    rejectReason: null,
    createdAt: SERVICES_NOW,
    updatedAt: SERVICES_NOW,
})

/** A finished workspace run. */
export const runRowOf = entityRowBuilder<DossierReviewRunEntity>({
    id: "r1",
    workspaceId: SERVICES_WORKSPACE,
    scope: "workspace",
    dossierId: null,
    trigger: "request",
    triggerRef: null,
    status: "done",
    requestedBy: "m1",
    aiState: "done",
    stats: { opened: 2, resolved: 1, dropped: 3 },
    error: null,
    startedAt: SERVICES_NOW,
    finishedAt: SERVICES_NOW,
    createdAt: SERVICES_NOW,
    updatedAt: SERVICES_NOW,
})

/** The reviewed state of dossier d1. */
export const reviewRowOf = entityRowBuilder<DossierReviewEntity>({
    id: "rv1",
    workspaceId: SERVICES_WORKSPACE,
    dossierId: "d1",
    status: "partial",
    openCount: 2,
    criticalCount: 0,
    highCount: 1,
    actualDocuments: 1,
    draftDocuments: 0,
    templateDocuments: 0,
    inputsFingerprint: "x",
    lastRunId: "r1",
    reviewedAt: SERVICES_NOW,
    createdAt: SERVICES_NOW,
    updatedAt: SERVICES_NOW,
})

/** Dossier 1 of the checklist, the registration certificate. */
export const dossierEntryOf = builder<DossierEntry>({
    id: "d1",
    ref: "1",
    category: "LEGAL FILES",
    categoryOrder: 1,
    position: 1,
    name: "Certificate",
    status: "present",
    existing: null,
    missing: null,
    drafts: null,
})

/** A ready document filed under dossier 1. */
export const dossierSourceOf = builder<DossierSource>({
    id: "s1",
    title: "01. Certificate",
    topic: "LEGAL FILES",
    tags: [],
    origin: null,
    kind: "file",
    status: "ready",
    chunkCount: 3,
    sizeBytes: 10,
    updatedAt: SERVICES_NOW.toISOString(),
    createdAt: SERVICES_NOW.toISOString(),
})
