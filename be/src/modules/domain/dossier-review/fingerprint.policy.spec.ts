import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import { citedIds, coverageKey, evidenceHashOf, fingerprintOf } from "./fingerprint.policy"

const SUBJECT = Symbol("fingerprint.policy")
type Subject = {
    citedIds: typeof citedIds
    coverageKey: typeof coverageKey
    evidenceHashOf: typeof evidenceHashOf
    fingerprintOf: typeof fingerprintOf
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { citedIds, coverageKey, evidenceHashOf, fingerprintOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const evidenceOf = builder<FindingEvidence>({
    role: "claim",
    label: "l",
    sourceId: null,
    sourceTitle: null,
    passageId: null,
    factId: null,
    factLine: null,
    quote: null,
})
const candidateOf = builder<FindingCandidate>({
    ruleKey: "presence.expected",
    dossierId: "d1",
    relatedDossierIds: [],
    kind: "missing",
    severity: "medium",
    origin: "rule",
    code: "presence_expected",
    params: {},
    title: "",
    detail: "",
    evidence: [evidenceOf()],
    remedyAction: "upload",
    remedyDocumentType: null,
    subject: "cccd",
})

describe("fingerprintOf", () => {
    it("hashes the rule, the dossier and the subject into 32 hex characters", async () => {
        const subject = await subjectOf()
        const print = subject.fingerprintOf(candidateOf())
        expect(print).toMatch(/^[0-9a-f]{32}$/u)
        expect(subject.fingerprintOf(candidateOf())).toBe(print)
        expect(subject.fingerprintOf(candidateOf({ subject: "other" }))).not.toBe(print)
        expect(subject.fingerprintOf(candidateOf({ dossierId: null }))).not.toBe(print)
    })

    it("hashes a model finding by dossier, kind and the sorted cited ids", async () => {
        const subject = await subjectOf()
        const first = candidateOf({
            origin: "ai",
            ruleKey: "ai",
            evidence: [evidenceOf({ sourceId: "s2", factId: "f1" }), evidenceOf({ sourceId: "s1" })],
        })
        const swapped = candidateOf({
            origin: "ai",
            ruleKey: "ai",
            subject: "ignored",
            evidence: [evidenceOf({ sourceId: "s1" }), evidenceOf({ sourceId: "s2", factId: "f1" })],
        })
        expect(subject.fingerprintOf(first)).toBe(subject.fingerprintOf(swapped))
        expect(
            subject.fingerprintOf(candidateOf({ origin: "ai", ruleKey: "ai", dossierId: null, evidence: [] })),
        ).toMatch(/^[0-9a-f]{32}$/u)
    })
})

describe("citedIds", () => {
    it("lists the distinct sorted source and fact ids", async () => {
        const subject = await subjectOf()
        expect(
            subject.citedIds([
                evidenceOf({ sourceId: "b", factId: "y" }),
                evidenceOf({ sourceId: "a", factId: "y" }),
                evidenceOf(),
            ]),
        ).toEqual({
            sources: ["a", "b"],
            facts: ["y"],
        })
    })
})

describe("evidenceHashOf", () => {
    it("ignores order, labels and roles but not quotes", async () => {
        const subject = await subjectOf()
        const one = evidenceOf({ sourceId: "a", quote: "x" })
        const two = evidenceOf({ sourceId: "b", quote: "y", label: "other", role: "counter" })
        expect(subject.evidenceHashOf([one, two])).toBe(subject.evidenceHashOf([two, one]))
        expect(subject.evidenceHashOf([one])).not.toBe(
            subject.evidenceHashOf([evidenceOf({ sourceId: "a", quote: "z" })]),
        )
    })
})

describe("coverageKey", () => {
    it("joins the rule and the dossier, with a dash for the workspace", async () => {
        const subject = await subjectOf()
        expect(subject.coverageKey("presence.expected", "d1")).toBe("presence.expected|d1")
        expect(subject.coverageKey("presence.expected", null)).toBe("presence.expected|-")
    })
})
