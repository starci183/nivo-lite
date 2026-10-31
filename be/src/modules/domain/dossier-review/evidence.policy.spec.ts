import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import { guardCandidates, itemHolds, normalizeQuote } from "./evidence.policy"
import type { EvidenceCorpus } from "./evidence.policy"

const SUBJECT = Symbol("evidence.policy")
type Subject = {
    guardCandidates: typeof guardCandidates
    itemHolds: typeof itemHolds
    normalizeQuote: typeof normalizeQuote
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { guardCandidates, itemHolds, normalizeQuote } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const corpus: EvidenceCorpus = {
    sources: new Map([
        ["s1", "Charter"],
        ["s2", "Bank statement"],
    ]),
    passages: new Map([
        ["p1", "The charter capital is   300,000,000 VND"],
        ["p2", "Contributed capital is 285,000,000 VND"],
    ]),
    facts: new Map([
        ["f1", { value: "300,000,000", quotes: ["Charter capital: 300,000,000 VND"] }],
        ["f2", { value: "64", quotes: [] }],
    ]),
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
    ruleKey: "ai",
    dossierId: "d1",
    relatedDossierIds: [],
    kind: "contradiction",
    severity: "high",
    origin: "ai",
    code: null,
    params: {},
    title: "t",
    detail: "d",
    evidence: [
        evidenceOf({ sourceId: "s1", passageId: "p1", quote: "charter capital is 300,000,000" }),
        evidenceOf({ sourceId: "s2", passageId: "p2", quote: "Contributed capital is 285,000,000" }),
    ],
    remedyAction: "decide",
    remedyDocumentType: null,
    subject: "",
})

describe("normalizeQuote", () => {
    it("composes, collapses whitespace and folds case", async () => {
        const subject = await subjectOf()
        expect(subject.normalizeQuote("  Abe\u0301   C ")).toBe("ab\u00e9 c")
    })
})

describe("itemHolds", () => {
    it("holds a quote that is a verbatim part of its passage", async () => {
        const subject = await subjectOf()
        expect(
            subject.itemHolds(evidenceOf({ passageId: "p1", quote: "CHARTER capital is 300,000,000" }), corpus),
        ).toBe(true)
    })

    it("refuses an unknown passage, a different quote or a short quote against a passage", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ passageId: "px", quote: "charter" }), corpus)).toBe(false)
        expect(subject.itemHolds(evidenceOf({ passageId: "p1", quote: "capital is 999" }), corpus)).toBe(false)
        expect(subject.itemHolds(evidenceOf({ passageId: "p1", quote: "charter" }), corpus)).toBe(false)
    })

    it("holds a passage cited without a quote", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ passageId: "p1" }), corpus)).toBe(true)
    })

    it("holds a fact quote from its value or its evidence quote", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ factId: "f1", quote: "300,000,000 VND" }), corpus)).toBe(true)
        expect(subject.itemHolds(evidenceOf({ factId: "f1", quote: "Charter capital: 300" }), corpus)).toBe(true)
    })

    it("holds a short quote only when it equals the value of the fact", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ factId: "f2", quote: "64" }), corpus)).toBe(true)
        expect(subject.itemHolds(evidenceOf({ factId: "f2", quote: "6" }), corpus)).toBe(false)
    })

    it("refuses an unknown fact and holds a fact cited without a quote", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ factId: "fx" }), corpus)).toBe(false)
        expect(subject.itemHolds(evidenceOf({ factId: "f1" }), corpus)).toBe(true)
    })

    it("holds a known source, refuses an unknown one and holds an item that cites nothing", async () => {
        const subject = await subjectOf()
        expect(subject.itemHolds(evidenceOf({ sourceId: "s1" }), corpus)).toBe(true)
        expect(subject.itemHolds(evidenceOf({ sourceId: "sx" }), corpus)).toBe(false)
        expect(subject.itemHolds(evidenceOf({ role: "expected" }), corpus)).toBe(true)
    })
})

describe("guardCandidates", () => {
    it("keeps a contradiction citing two documents", async () => {
        const subject = await subjectOf()
        expect(subject.guardCandidates([candidateOf()], corpus, [])).toEqual({ kept: [candidateOf()], dropped: [] })
    })

    it("keeps only the evidence that verifies", async () => {
        const subject = await subjectOf()
        const bad = evidenceOf({ sourceId: "s1", passageId: "p1", quote: "invented words here" })
        const outcome = subject.guardCandidates(
            [candidateOf({ kind: "missing", evidence: [...candidateOf().evidence, bad] })],
            corpus,
            [],
        )
        expect(outcome.kept[0]?.evidence).toHaveLength(2)
    })

    it("caps the evidence at eight items", async () => {
        const subject = await subjectOf()
        const many = Array.from({ length: 10 }, () => evidenceOf({ sourceId: "s1" }))
        expect(
            subject.guardCandidates([candidateOf({ kind: "missing", evidence: many })], corpus, []).kept[0]?.evidence,
        ).toHaveLength(8)
    })

    it("drops a model candidate with no source or fact evidence left, even with an expectation", async () => {
        const subject = await subjectOf()
        const only = [evidenceOf({ role: "expected" })]
        expect(subject.guardCandidates([candidateOf({ kind: "missing", evidence: only })], corpus, []).dropped).toEqual(
            ["no_evidence"],
        )
    })

    it("keeps a rule candidate that rests on an expectation alone and drops one with nothing left", async () => {
        const subject = await subjectOf()
        const rule = { origin: "rule", ruleKey: "presence.expected", kind: "missing", severity: "critical" } as const
        expect(
            subject.guardCandidates(
                [candidateOf({ ...rule, evidence: [evidenceOf({ role: "expected" })] })],
                corpus,
                [],
            ).dropped,
        ).toEqual([])
        const unverified = [evidenceOf({ sourceId: "sx" })]
        expect(subject.guardCandidates([candidateOf({ ...rule, evidence: unverified })], corpus, []).dropped).toEqual([
            "no_evidence",
        ])
    })
})

describe("guardCandidates drops", () => {
    it("drops a contradiction that keeps one document only", async () => {
        const subject = await subjectOf()
        const one = [evidenceOf({ sourceId: "s1", passageId: "p1" }), evidenceOf({ sourceId: "s1", passageId: "p1" })]
        expect(subject.guardCandidates([candidateOf({ evidence: one })], corpus, []).dropped).toEqual([
            "single_source_contradiction",
        ])
    })

    it("counts two facts of one document as two units", async () => {
        const subject = await subjectOf()
        const two = [evidenceOf({ sourceId: "s1", factId: "f1" }), evidenceOf({ sourceId: "s1", factId: "f2" })]
        expect(subject.guardCandidates([candidateOf({ evidence: two })], corpus, []).dropped).toEqual([])
    })

    it("drops a kind or severity outside the enums and a critical model finding", async () => {
        const subject = await subjectOf()
        expect(subject.guardCandidates([candidateOf({ kind: "weird" })], corpus, []).dropped).toEqual(["bad_kind"])
        expect(subject.guardCandidates([candidateOf({ severity: "huge" })], corpus, []).dropped).toEqual([
            "bad_severity",
        ])
        expect(subject.guardCandidates([candidateOf({ severity: "critical" })], corpus, []).dropped).toEqual([
            "bad_severity",
        ])
    })

    it("lets a rule candidate be critical", async () => {
        const subject = await subjectOf()
        expect(
            subject.guardCandidates([candidateOf({ origin: "rule", severity: "critical" })], corpus, []).dropped,
        ).toEqual([])
    })

    it("drops a model finding that repeats a known finding but not a rule candidate", async () => {
        const subject = await subjectOf()
        const known = [{ kind: "contradiction", ids: ["s2", "s1"] }]
        expect(subject.guardCandidates([candidateOf()], corpus, known).dropped).toEqual(["duplicate_known"])
        expect(subject.guardCandidates([candidateOf({ origin: "rule" })], corpus, known).dropped).toEqual([])
        expect(
            subject.guardCandidates([candidateOf()], corpus, [{ kind: "missing", ids: ["s1", "s2"] }]).dropped,
        ).toEqual([])
    })
})
