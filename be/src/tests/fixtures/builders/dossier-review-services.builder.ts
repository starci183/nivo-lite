import { dossierReviewEntities, type FindingEvidence } from "@modules/domain/dossier-review"
import { builder } from "@starci/jest-preset"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import type { DossierSource } from "@modules/domain/knowledge-sources"
import { entityRowBuilder } from "./entity-row.builder"

const DossierReviewRunEntity: (typeof dossierReviewEntities)[0] = dossierReviewEntities[0]
const DossierFindingEntity: (typeof dossierReviewEntities)[1] = dossierReviewEntities[1]
const DossierReviewEntity: (typeof dossierReviewEntities)[2] = dossierReviewEntities[2]
const DossierRemedyDraftEntity: (typeof dossierReviewEntities)[3] = dossierReviewEntities[3]
type DossierReviewRunEntity = InstanceType<typeof DossierReviewRunEntity>
type DossierFindingEntity = InstanceType<typeof DossierFindingEntity>
type DossierReviewEntity = InstanceType<typeof DossierReviewEntity>
type DossierRemedyDraftEntity = InstanceType<typeof DossierRemedyDraftEntity>

/** The workspace the rows of the dossier review services belong to. */
export const SERVICES_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** The instant the service specs run at. */
export const SERVICES_NOW: Date = new Date("2026-10-31T10:00:00.000Z")

/** The id of the first finding, UUID-shaped so a page cursor can carry it. */
export const FINDING_ID = "aaaaaaaa-0000-4000-8000-000000000001"

/** The id of the draft the specs work on. */
export const DRAFT_ID = "bbbbbbbb-0000-4000-8000-000000000001"

type FindingRowOfShape = {
    readonly workspaceId?: string
    readonly dossierId?: string | null
    readonly relatedDossierIds?: Array<string>
    readonly kind?: "contradiction" | "missing" | "expired" | "unsigned" | "outdated" | "unreasonable"
    readonly severity?: "critical" | "high" | "medium" | "low"
    readonly origin?: "rule" | "ai"
    readonly ruleKey?: string
    readonly fingerprint?: string
    readonly code?: string | null
    readonly params?: Record<string, string>
    readonly title?: string
    readonly detail?: string
    readonly evidence?: Array<FindingEvidence>
    readonly evidenceHash?: string
    readonly sourceIds?: Array<string>
    readonly factIds?: Array<string>
    readonly remedyAction?: "upload" | "draft" | "decide" | "external"
    readonly remedyDocumentType?: string | null
    readonly status?: "open" | "confirmed" | "dismissed" | "resolved"
    readonly resolution?: "document" | "draft" | "not_detected" | "manual" | null
    readonly dismissReason?: string | null
    readonly dismissedEvidenceHash?: string | null
    readonly reopenedCount?: number
    readonly decidedBy?: string | null
    readonly decidedAt?: Date | null
    readonly decisionNote?: string | null
    readonly assigneeId?: string | null
    readonly dueAt?: string | null
    readonly firstSeenRunId?: string | null
    readonly lastSeenRunId?: string | null
    readonly firstSeenAt?: Date
    readonly lastSeenAt?: Date
    readonly resolvedAt?: Date | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** An open rule finding of dossier d1: the document its pack expects is missing. */
export const findingRowOf: (changes?: FindingRowOfShape) => DossierFindingEntity =
    entityRowBuilder<DossierFindingEntity>({
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

type DraftRowOfShape = {
    readonly workspaceId?: string
    readonly findingId?: string
    readonly dossierId?: string | null
    readonly status?: "generating" | "proposed" | "approved" | "rejected" | "failed"
    readonly instructions?: string | null
    readonly title?: string
    readonly documentType?: string
    readonly body?: string
    readonly placeholders?: DossierRemedyDraftEntity["placeholders"]
    readonly model?: string | null
    readonly error?: string | null
    readonly sourceId?: string | null
    readonly requestedBy?: string
    readonly decidedBy?: string | null
    readonly decidedAt?: Date | null
    readonly rejectReason?: string | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** A generating remedy draft of the first finding, with the owner's instructions. */
export const draftRowOf: (changes?: DraftRowOfShape) => DossierRemedyDraftEntity =
    entityRowBuilder<DossierRemedyDraftEntity>({
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

type RunRowOfShape = {
    readonly workspaceId?: string
    readonly scope?: "dossier" | "workspace"
    readonly dossierId?: string | null
    readonly trigger?: "document" | "document_gone" | "request"
    readonly triggerRef?: string | null
    readonly status?: "queued" | "running" | "done" | "failed"
    readonly requestedBy?: string | null
    readonly aiState?: "done" | "partial" | "skipped_unchanged" | "skipped_credits" | "skipped_budget" | "failed" | null
    readonly stats?: DossierReviewRunEntity["stats"]
    readonly error?: string | null
    readonly startedAt?: Date | null
    readonly finishedAt?: Date | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** A finished workspace run. */
export const runRowOf: (changes?: RunRowOfShape) => DossierReviewRunEntity = entityRowBuilder<DossierReviewRunEntity>({
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

type ReviewRowOfShape = {
    readonly workspaceId?: string
    readonly dossierId?: string
    readonly status?: "present" | "partial" | "drafted" | "missing" | "template"
    readonly openCount?: number
    readonly criticalCount?: number
    readonly highCount?: number
    readonly actualDocuments?: number
    readonly draftDocuments?: number
    readonly templateDocuments?: number
    readonly inputsFingerprint?: string | null
    readonly lastRunId?: string | null
    readonly reviewedAt?: Date
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** The reviewed state of dossier d1. */
export const reviewRowOf: (changes?: ReviewRowOfShape) => DossierReviewEntity = entityRowBuilder<DossierReviewEntity>({
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
export const dossierEntryOf: (overrides?: Partial<DossierEntry>) => DossierEntry = builder<DossierEntry>({
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
export const dossierSourceOf: (overrides?: Partial<DossierSource>) => DossierSource = builder<DossierSource>({
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
