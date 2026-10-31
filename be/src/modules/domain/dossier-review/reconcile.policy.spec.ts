import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import { REOPEN_NOTES, reconcile } from "./reconcile.policy"
import type { PreparedCandidate, ReconcileInput, StoredFinding } from "./reconcile.policy"

const SUBJECT = Symbol("reconcile.policy")
type Subject = { reconcile: typeof reconcile }
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { reconcile } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-10-31T10:00:00.000Z")
const candidateOf = builder<FindingCandidate>({
    ruleKey: "presence.expected",
    dossierId: "d1",
    relatedDossierIds: ["d2"],
    kind: "missing",
    severity: "medium",
    origin: "rule",
    code: "presence_expected",
    params: { expectation: "cccd" },
    title: "T",
    detail: "D",
    evidence: [
        {
            role: "expected",
            label: "cccd",
            sourceId: "s1",
            sourceTitle: null,
            passageId: null,
            factId: "f1",
            factLine: null,
            quote: null,
        },
    ],
    remedyAction: "upload",
    remedyDocumentType: null,
    subject: "cccd",
})
const preparedOf = builder<PreparedCandidate>({ candidate: candidateOf(), fingerprint: "fp1", evidenceHash: "h2" })
const storedOf = builder<StoredFinding>({
    id: "id1",
    fingerprint: "fp1",
    origin: "rule",
    ruleKey: "presence.expected",
    dossierId: "d1",
    status: "open",
    evidenceHash: "h1",
    dismissedEvidenceHash: null,
    reopenedCount: 0,
    remedyAction: "upload",
})
const inputOf = builder<ReconcileInput>({
    runId: "run1",
    now: NOW,
    trigger: "request",
    stored: [],
    candidates: [],
    coverage: new Set(["presence.expected|d1"]),
    aiResolved: new Set(),
})
const seen = { lastSeenRunId: "run1", lastSeenAt: NOW }

describe("reconcile", () => {
    it("inserts a candidate nobody stored once, even when found twice", async () => {
        const subject = await subjectOf()
        const result = subject.reconcile(inputOf({ candidates: [preparedOf(), preparedOf({ evidenceHash: "x" })] }))
        expect(result).toEqual({ inserts: [preparedOf()], changes: [], opened: 1, resolved: 0 })
    })

    it("updates an open finding in place with the new content and evidence ids", async () => {
        const subject = await subjectOf()
        const result = subject.reconcile(
            inputOf({ stored: [storedOf({ status: "confirmed" })], candidates: [preparedOf()] }),
        )
        expect(result.inserts).toEqual([])
        expect(result.changes).toEqual([
            {
                id: "id1",
                changes: {
                    kind: "missing",
                    severity: "medium",
                    code: "presence_expected",
                    params: { expectation: "cccd" },
                    title: "T",
                    detail: "D",
                    evidence: candidateOf().evidence,
                    evidenceHash: "h2",
                    sourceIds: ["s1"],
                    factIds: ["f1"],
                    relatedDossierIds: ["d2"],
                    remedyAction: "upload",
                    remedyDocumentType: null,
                    ...seen,
                },
            },
        ])
        expect(result.opened).toBe(0)
    })

    it("keeps a dismissed finding dismissed while its evidence is the same", async () => {
        const subject = await subjectOf()
        const stored = storedOf({ status: "dismissed", dismissedEvidenceHash: "h2" })
        const result = subject.reconcile(inputOf({ stored: [stored], candidates: [preparedOf()] }))
        expect(result).toEqual({ inserts: [], changes: [{ id: "id1", changes: seen }], opened: 0, resolved: 0 })
    })

    it("reopens a dismissed finding re-detected with new evidence", async () => {
        const subject = await subjectOf()
        const stored = storedOf({ status: "dismissed", dismissedEvidenceHash: "old", reopenedCount: 1 })
        const result = subject.reconcile(inputOf({ stored: [stored], candidates: [preparedOf()] }))
        expect(result.opened).toBe(1)
        expect(result.changes[0]?.changes).toMatchObject({
            status: "open",
            reopenedCount: 2,
            decisionNote: REOPEN_NOTES.evidence,
            evidenceHash: "h2",
        })
    })

    it("opens a resolved finding again when it is detected again", async () => {
        const subject = await subjectOf()
        const result = subject.reconcile(
            inputOf({ stored: [storedOf({ status: "resolved" })], candidates: [preparedOf()] }),
        )
        expect(result.opened).toBe(1)
        expect(result.changes[0]?.changes).toMatchObject({
            status: "open",
            resolution: null,
            resolvedAt: null,
            reopenedCount: 1,
            decisionNote: REOPEN_NOTES.detected,
        })
    })
})

describe("reconcile resolutions", () => {
    it("resolves a rule finding no longer detected inside the coverage as not detected", async () => {
        const subject = await subjectOf()
        const result = subject.reconcile(inputOf({ stored: [storedOf()] }))
        expect(result).toEqual({
            inserts: [],
            changes: [
                { id: "id1", changes: { ...seen, status: "resolved", resolution: "not_detected", resolvedAt: NOW } },
            ],
            opened: 0,
            resolved: 1,
        })
    })

    it("resolves an upload finding with the document when a document started the run", async () => {
        const subject = await subjectOf()
        const result = subject.reconcile(inputOf({ trigger: "document", stored: [storedOf({ status: "confirmed" })] }))
        expect(result.changes[0]?.changes.resolution).toBe("document")
        const external = subject.reconcile(
            inputOf({ trigger: "document", stored: [storedOf({ remedyAction: "external" })] }),
        )
        expect(external.changes[0]?.changes.resolution).toBe("not_detected")
    })

    it("leaves a finding outside the coverage and a closed finding alone", async () => {
        const subject = await subjectOf()
        expect(subject.reconcile(inputOf({ coverage: new Set(), stored: [storedOf()] })).changes).toEqual([])
        expect(
            subject.reconcile(
                inputOf({
                    stored: [
                        storedOf({ status: "dismissed" }),
                        storedOf({ id: "id2", fingerprint: "fp2", status: "resolved" }),
                    ],
                }),
            ).changes,
        ).toEqual([])
    })

    it("never resolves a model finding by absence but does when the model resolved it", async () => {
        const subject = await subjectOf()
        const ai = storedOf({ origin: "ai", ruleKey: "ai" })
        expect(subject.reconcile(inputOf({ stored: [ai], coverage: new Set(["ai|d1"]) })).changes).toEqual([])
        const result = subject.reconcile(inputOf({ stored: [ai], aiResolved: new Set(["fp1"]) }))
        expect(result.resolved).toBe(1)
        expect(result.changes[0]?.changes.resolution).toBe("document")
    })

    it("covers a workspace finding by the dash key", async () => {
        const subject = await subjectOf()
        const stored = storedOf({ dossierId: null })
        expect(
            subject.reconcile(inputOf({ stored: [stored], coverage: new Set(["presence.expected|-"]) })).resolved,
        ).toBe(1)
    })
})
