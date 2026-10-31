import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import type { FindingEvidence } from "./dossier-review.contracts"
import {
    toDossierReviewRecord,
    toDraftRecord,
    toFindingRecord,
    toFindingRows,
    toFindingUpdate,
    toRunRecord,
    toStoredFinding,
} from "./finding-record.mapper"
import type {
    DossierFindingEntity,
    DossierRemedyDraftEntity,
    DossierReviewEntity,
    DossierReviewRunEntity,
} from "./persistence/entities"
import type { PreparedCandidate } from "./reconcile.policy"

const SUBJECT = Symbol("finding-record.mapper")
type Subject = {
    toDossierReviewRecord: typeof toDossierReviewRecord
    toDraftRecord: typeof toDraftRecord
    toFindingRecord: typeof toFindingRecord
    toFindingRows: typeof toFindingRows
    toFindingUpdate: typeof toFindingUpdate
    toRunRecord: typeof toRunRecord
    toStoredFinding: typeof toStoredFinding
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    toDossierReviewRecord,
                    toDraftRecord,
                    toFindingRecord,
                    toFindingRows,
                    toFindingUpdate,
                    toRunRecord,
                    toStoredFinding,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const AT = new Date("2026-10-31T10:00:00.000Z")
const EARLIER = new Date("2026-10-01T08:00:00.000Z")

const evidenceOf = builder<FindingEvidence>({
    role: "claim",
    label: "Charter",
    sourceId: "s1",
    sourceTitle: "02. Charter",
    passageId: "p1",
    factId: "f1",
    factLine: null,
    quote: "300.000.000",
})

const findingOf = builder<DossierFindingEntity>({
    id: "fd1",
    workspaceId: "w1",
    dossierId: "d2",
    relatedDossierIds: ["d1"],
    kind: "contradiction",
    severity: "high",
    origin: "rule",
    ruleKey: "amounts.invariant",
    fingerprint: "fp1",
    code: "amounts_invariant",
    params: { values: "300; 285", invariant: "Charter capital" },
    title: "stored title",
    detail: "stored detail",
    evidence: [evidenceOf()],
    evidenceHash: "h1",
    sourceIds: ["s1"],
    factIds: ["f1"],
    remedyAction: "decide",
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
    firstSeenAt: EARLIER,
    lastSeenAt: AT,
    resolvedAt: null,
    createdAt: EARLIER,
    updatedAt: AT,
})

const runOf = builder<DossierReviewRunEntity>({
    id: "r1",
    workspaceId: "w1",
    scope: "dossier",
    dossierId: "d2",
    trigger: "request",
    triggerRef: null,
    status: "done",
    requestedBy: "m1",
    aiState: "done",
    stats: { opened: 2, resolved: 1, dropped: 3 },
    error: null,
    startedAt: EARLIER,
    finishedAt: AT,
    createdAt: EARLIER,
    updatedAt: AT,
})

const draftOf = builder<DossierRemedyDraftEntity>({
    id: "dr1",
    workspaceId: "w1",
    findingId: "fd1",
    dossierId: "d2",
    status: "approved",
    instructions: "Keep it short",
    title: "Resolution",
    documentType: "Resolution",
    body: "Body",
    placeholders: [{ label: "Date", reason: "Not known" }],
    model: "m",
    error: null,
    sourceId: "s9",
    requestedBy: "m1",
    decidedBy: "m1",
    decidedAt: AT,
    rejectReason: null,
    createdAt: EARLIER,
    updatedAt: AT,
})

const reviewOf = builder<DossierReviewEntity>({
    id: "rv1",
    workspaceId: "w1",
    dossierId: "d2",
    status: "partial",
    openCount: 3,
    criticalCount: 1,
    highCount: 2,
    actualDocuments: 1,
    draftDocuments: 0,
    templateDocuments: 0,
    inputsFingerprint: null,
    lastRunId: "r1",
    reviewedAt: AT,
    createdAt: EARLIER,
    updatedAt: AT,
})

const candidateOf = builder<FindingCandidate>({
    ruleKey: "amounts.invariant",
    dossierId: "d2",
    relatedDossierIds: ["d1"],
    kind: "contradiction",
    severity: "high",
    origin: "rule",
    code: "amounts_invariant",
    params: { invariant: "Charter capital" },
    title: "T",
    detail: "D",
    evidence: [evidenceOf(), evidenceOf({ sourceId: "s2", factId: "f2" })],
    remedyAction: "decide",
    remedyDocumentType: null,
    subject: "charter_capital",
})

const preparedOf = (candidate: FindingCandidate): PreparedCandidate => ({
    candidate,
    fingerprint: "fp9",
    evidenceHash: "h9",
})

const SEEN = { workspaceId: "w1", runId: "r2", now: AT }
const RESOLVED = { resolvedAt: AT, decidedAt: AT, status: "resolved", resolution: "manual" } as const
const DISMISSED = { dismissedEvidenceHash: "h0", status: "dismissed" } as const
const QUEUED = { stats: {}, startedAt: null, finishedAt: null, status: "queued", aiState: null } as const
const LIVE_DRAFT = { id: "dr1", status: "proposed" } as const

describe("toFindingRecord", () => {
    it("maps a finding with its dossier, its draft, its words and its params sorted by name", async () => {
        const subject = await subjectOf()
        const record = subject.toFindingRecord(findingOf(RESOLVED), {
            dossier: { ref: "2", name: "Charter" },
            draft: LIVE_DRAFT,
            text: { title: "Rendered", detail: "Rendered detail" },
        })

        expect(record).toEqual({
            id: "fd1",
            dossierId: "d2",
            dossierRef: "2",
            dossierName: "Charter",
            relatedDossierIds: ["d1"],
            kind: "contradiction",
            severity: "high",
            origin: "rule",
            code: "amounts_invariant",
            params: [
                { name: "invariant", value: "Charter capital" },
                { name: "values", value: "300; 285" },
            ],
            title: "Rendered",
            detail: "Rendered detail",
            evidence: [evidenceOf()],
            remedyAction: "decide",
            remedyDocumentType: null,
            status: "resolved",
            resolution: "manual",
            dismissReason: null,
            decisionNote: null,
            reopenedCount: 0,
            assigneeId: null,
            dueAt: null,
            draftId: "dr1",
            draftStatus: "proposed",
            firstSeenAt: "2026-10-01T08:00:00.000Z",
            lastSeenAt: "2026-10-31T10:00:00.000Z",
            resolvedAt: "2026-10-31T10:00:00.000Z",
            decidedAt: "2026-10-31T10:00:00.000Z",
            createdAt: "2026-10-01T08:00:00.000Z",
            updatedAt: "2026-10-31T10:00:00.000Z",
        })
    })

    it("answers nulls when the dossier and the draft are unknown", async () => {
        const subject = await subjectOf()
        const record = subject.toFindingRecord(findingOf(), {
            dossier: undefined,
            draft: undefined,
            text: { title: "stored title", detail: "stored detail" },
        })

        expect(record).toMatchObject({
            dossierRef: null,
            dossierName: null,
            draftId: null,
            draftStatus: null,
            resolvedAt: null,
            decidedAt: null,
        })
    })
})

describe("toStoredFinding", () => {
    it("keeps what the reconciliation reads", async () => {
        const subject = await subjectOf()
        expect(subject.toStoredFinding(findingOf(DISMISSED))).toEqual({
            id: "fd1",
            fingerprint: "fp1",
            origin: "rule",
            ruleKey: "amounts.invariant",
            dossierId: "d2",
            status: "dismissed",
            evidenceHash: "h1",
            dismissedEvidenceHash: "h0",
            reopenedCount: 0,
            remedyAction: "decide",
        })
    })
})

describe("toRunRecord", () => {
    it("maps a run with its counts and instants", async () => {
        const subject = await subjectOf()
        expect(subject.toRunRecord(runOf())).toEqual({
            id: "r1",
            scope: "dossier",
            dossierId: "d2",
            trigger: "request",
            status: "done",
            aiState: "done",
            opened: 2,
            resolved: 1,
            dropped: 3,
            startedAt: "2026-10-01T08:00:00.000Z",
            finishedAt: "2026-10-31T10:00:00.000Z",
            createdAt: "2026-10-01T08:00:00.000Z",
        })
    })

    it("counts zero for a run that has no stats yet", async () => {
        const subject = await subjectOf()
        const queued = runOf(QUEUED)

        expect(subject.toRunRecord(queued)).toMatchObject({
            opened: 0,
            resolved: 0,
            dropped: 0,
            startedAt: null,
            finishedAt: null,
            aiState: null,
        })
    })
})

describe("toDraftRecord", () => {
    it("maps a draft with its placeholders", async () => {
        const subject = await subjectOf()
        expect(subject.toDraftRecord(draftOf())).toEqual({
            id: "dr1",
            findingId: "fd1",
            dossierId: "d2",
            status: "approved",
            title: "Resolution",
            documentType: "Resolution",
            body: "Body",
            placeholders: [{ label: "Date", reason: "Not known" }],
            error: null,
            sourceId: "s9",
            instructions: "Keep it short",
            rejectReason: null,
            decidedAt: "2026-10-31T10:00:00.000Z",
            createdAt: "2026-10-01T08:00:00.000Z",
            updatedAt: "2026-10-31T10:00:00.000Z",
        })
    })
})

describe("toDossierReviewRecord", () => {
    it("maps the recomputed state with the checklist status beside it", async () => {
        const subject = await subjectOf()
        expect(subject.toDossierReviewRecord(reviewOf(), "present")).toEqual({
            dossierId: "d2",
            status: "partial",
            checklistStatus: "present",
            openCount: 3,
            criticalCount: 1,
            highCount: 2,
            reviewedAt: "2026-10-31T10:00:00.000Z",
        })
    })
})

describe("toFindingRows", () => {
    it("writes the row of a new finding with its cited ids and where it was first seen", async () => {
        const subject = await subjectOf()
        expect(subject.toFindingRows(preparedOf(candidateOf()), SEEN)).toEqual([
            {
                workspaceId: "w1",
                dossierId: "d2",
                relatedDossierIds: ["d1"],
                kind: "contradiction",
                severity: "high",
                origin: "rule",
                ruleKey: "amounts.invariant",
                fingerprint: "fp9",
                code: "amounts_invariant",
                params: { invariant: "Charter capital" },
                title: "T",
                detail: "D",
                evidence: [evidenceOf(), evidenceOf({ sourceId: "s2", factId: "f2" })],
                evidenceHash: "h9",
                sourceIds: ["s1", "s2"],
                factIds: ["f1", "f2"],
                remedyAction: "decide",
                remedyDocumentType: null,
                firstSeenRunId: "r2",
                lastSeenRunId: "r2",
                firstSeenAt: AT,
                lastSeenAt: AT,
            },
        ])
    })

    it.each([{ kind: "odd" }, { severity: "odd" }, { remedyAction: "odd" }])(
        "writes nothing for a candidate outside the enums (%o)",
        async (override) => {
            const subject = await subjectOf()
            expect(subject.toFindingRows(preparedOf(candidateOf(override)), SEEN)).toEqual([])
        },
    )
})

describe("toFindingUpdate", () => {
    it("keeps the kind, severity and remedy inside the enums with the other columns", async () => {
        const subject = await subjectOf()
        const changes = {
            kind: "missing",
            severity: "low",
            remedyAction: "upload",
            title: "T",
            lastSeenRunId: "r2",
            lastSeenAt: AT,
        }

        expect(subject.toFindingUpdate(changes)).toEqual(changes)
    })

    it("drops a kind, severity or remedy outside the enums and leaves out what is absent", async () => {
        const subject = await subjectOf()
        const odd = { kind: "odd", severity: "odd", remedyAction: "odd", lastSeenRunId: null, lastSeenAt: AT }

        expect(subject.toFindingUpdate(odd)).toEqual({ lastSeenRunId: null, lastSeenAt: AT })
        expect(subject.toFindingUpdate({ lastSeenRunId: "r3", lastSeenAt: AT })).toEqual({
            lastSeenRunId: "r3",
            lastSeenAt: AT,
        })
    })
})
