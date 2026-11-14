import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FindingEvidence } from "./dossier-review.contracts"
import { evidenceHashOf, normalizeQuote } from "./evidence.policy"

const SUBJECT = Symbol("evidence.policy")
type Subject = {
    evidenceHashOf: typeof evidenceHashOf
    normalizeQuote: typeof normalizeQuote
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { evidenceHashOf, normalizeQuote } }],
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

describe("normalizeQuote", () => {
    it("composes, collapses whitespace and folds case", async () => {
        const subject = await subjectOf()
        expect(subject.normalizeQuote("  Abe\u0301   C ")).toBe("ab\u00e9 c")
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
