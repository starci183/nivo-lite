import { DOSSIER_REVIEW_SCHEMA } from "./dossier-review.schema"

const evidence = { key: "S1.P1", quote: "Von dieu le 300.000.000 dong" }
const finding = {
    kind: "contradiction",
    severity: "high",
    title: "Von dieu le khong khop",
    detail: "Dieu le va sao ke ghi hai so khac nhau.",
    evidence: [evidence],
    relatedRefs: ["8"],
    remedyAction: "decide",
    documentType: null,
}
const answerOf = (overrides: Record<string, unknown>) => ({ findings: [finding], stillOpen: [], ...overrides })

describe("DOSSIER_REVIEW_SCHEMA", () => {
    it("reads an answer with a finding and a verdict", () => {
        const answer = answerOf({ stillOpen: [{ key: "A1", applies: false, evidence: [evidence] }] })
        expect(DOSSIER_REVIEW_SCHEMA.safeParse(answer).success).toBe(true)
    })

    it("reads an answer with nothing found", () => {
        expect(DOSSIER_REVIEW_SCHEMA.safeParse({ findings: [], stillOpen: [] }).success).toBe(true)
    })

    it.each([
        ["a ninth finding", answerOf({ findings: Array.from({ length: 9 }, () => finding) })],
        ["a critical severity", answerOf({ findings: [{ ...finding, severity: "critical" }] })],
        ["a kind outside the enum", answerOf({ findings: [{ ...finding, kind: "other" }] })],
        ["a title of two characters", answerOf({ findings: [{ ...finding, title: "ab" }] })],
        ["a title of 141 characters", answerOf({ findings: [{ ...finding, title: "a".repeat(141) }] })],
        ["a detail of 601 characters", answerOf({ findings: [{ ...finding, detail: "a".repeat(601) }] })],
        ["a finding with no evidence", answerOf({ findings: [{ ...finding, evidence: [] }] })],
        [
            "a finding with seven evidence items",
            answerOf({ findings: [{ ...finding, evidence: Array(7).fill(evidence) }] }),
        ],
        [
            "a quote of 301 characters",
            answerOf({ findings: [{ ...finding, evidence: [{ key: "F1", quote: "a".repeat(301) }] }] }),
        ],
        ["six related refs", answerOf({ findings: [{ ...finding, relatedRefs: ["1", "2", "3", "4", "5", "6"] }] })],
        ["a remedy action outside the enum", answerOf({ findings: [{ ...finding, remedyAction: "ignore" }] })],
        ["a document type of 81 characters", answerOf({ findings: [{ ...finding, documentType: "a".repeat(81) }] })],
        [
            "twenty-one verdicts",
            answerOf({ stillOpen: Array.from({ length: 21 }, () => ({ key: "A1", applies: true, evidence: [] })) }),
        ],
        [
            "a verdict with four evidence items",
            answerOf({ stillOpen: [{ key: "A1", applies: true, evidence: Array(4).fill(evidence) }] }),
        ],
        ["a verdict that does not say whether it applies", answerOf({ stillOpen: [{ key: "A1", evidence: [] }] })],
    ])("refuses %s", (_name, answer) => {
        expect(DOSSIER_REVIEW_SCHEMA.safeParse(answer).success).toBe(false)
    })
})
