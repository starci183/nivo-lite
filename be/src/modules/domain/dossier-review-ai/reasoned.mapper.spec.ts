import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DossierReviewAnswer } from "./dossier-review.schema"
import { toReasonedReview as realToReasonedReview, toRemedyText as realToRemedyText } from "./reasoned.mapper"
import type { CallFigures } from "./reasoned.mapper"
import type { RemedyAnswer } from "./remedy.schema"

type AnswerFinding = DossierReviewAnswer["findings"][number]

const FIGURES: CallFigures = { model: "m1", promptTokens: 100, completionTokens: 20 }

const findingOf = builder<AnswerFinding>({
    kind: "contradiction",
    severity: "high",
    title: "Von dieu le khong khop",
    detail: "Dieu le va sao ke ghi hai so khac nhau.",
    evidence: [{ key: "S1.P1", quote: "Von dieu le 300.000.000 dong" }],
    relatedRefs: ["8"],
    remedyAction: "decide",
    documentType: "Bien ban gop von",
})

const remedyOf = builder<RemedyAnswer>({
    title: "Nghi quyet thong qua Dieu le sua doi",
    documentType: "Nghi quyet HDTV",
    body: "# Nghi quyet\n\nNgay [Signing date: dd/mm/yyyy]",
    placeholders: [{ label: "Ngay ky", reason: "Chua co ngay hop" }],
})

const SUBJECT = Symbol("reasoned.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { toReasonedReview: realToReasonedReview, toRemedyText: realToRemedyText } },
        ],
    }).compile()
    return moduleRef.get<{ toReasonedReview: typeof realToReasonedReview; toRemedyText: typeof realToRemedyText }>(
        SUBJECT,
    )
}

describe("toReasonedReview", () => {
    it("carries a finding, a verdict and the figures of the call as they are", async () => {
        const subject = await build()
        const review = subject.toReasonedReview(
            {
                findings: [findingOf()],
                stillOpen: [{ key: "A1", applies: false, evidence: [{ key: "F1", quote: "da cap nhat" }] }],
            },
            FIGURES,
        )
        expect(review).toEqual({
            findings: [
                {
                    kind: "contradiction",
                    severity: "high",
                    title: "Von dieu le khong khop",
                    detail: "Dieu le va sao ke ghi hai so khac nhau.",
                    evidence: [{ key: "S1.P1", quote: "Von dieu le 300.000.000 dong" }],
                    relatedRefs: ["8"],
                    remedyAction: "decide",
                    documentType: "Bien ban gop von",
                },
            ],
            stillOpen: [{ key: "A1", applies: false, evidence: [{ key: "F1", quote: "da cap nhat" }] }],
            model: "m1",
            promptTokens: 100,
            completionTokens: 20,
        })
    })

    it("reports tokens the call did not report as null", async () => {
        const subject = await build()
        const review = subject.toReasonedReview(
            { findings: [], stillOpen: [] },
            { model: "m2", promptTokens: null, completionTokens: null },
        )
        expect(review).toEqual({
            findings: [],
            stillOpen: [],
            model: "m2",
            promptTokens: null,
            completionTokens: null,
        })
    })

    it("collapses whitespace in titles and quotes and trims the detail", async () => {
        const subject = await build()
        const [finding] = subject.toReasonedReview(
            {
                findings: [
                    findingOf({
                        title: "  Von   dieu le \n khong khop ",
                        detail: "\n  Hai so khac nhau.  ",
                        evidence: [{ key: " S1.P1 ", quote: "Von\n dieu   le" }],
                    }),
                ],
                stillOpen: [],
            },
            FIGURES,
        ).findings
        expect(finding?.title).toBe("Von dieu le khong khop")
        expect(finding?.detail).toBe("Hai so khac nhau.")
        expect(finding?.evidence).toEqual([{ key: "S1.P1", quote: "Von dieu le" }])
    })
})

describe("toReasonedReview bounds", () => {
    it("cuts every text to its bound", async () => {
        const subject = await build()
        const [finding] = subject.toReasonedReview(
            {
                findings: [
                    findingOf({
                        title: "t".repeat(200),
                        detail: "d".repeat(700),
                        evidence: [{ key: "k".repeat(30), quote: "q".repeat(400) }],
                        documentType: "x".repeat(100),
                    }),
                ],
                stillOpen: [],
            },
            FIGURES,
        ).findings
        expect(finding?.title).toHaveLength(140)
        expect(finding?.detail).toHaveLength(600)
        expect(finding?.evidence).toEqual([{ key: "k".repeat(16), quote: "q".repeat(300) }])
        expect(finding?.documentType).toHaveLength(80)
    })

    it("keeps at most eight findings, six quotes, five distinct references and three quotes per verdict", async () => {
        const subject = await build()
        const quote = (n: number) => ({ key: `F${n}`, quote: "q" })
        const review = subject.toReasonedReview(
            {
                findings: Array.from({ length: 10 }, () =>
                    findingOf({
                        evidence: [1, 2, 3, 4, 5, 6, 7, 8].map(quote),
                        relatedRefs: ["1", "1", " 2 ", "3", "4", "5", "6", "7"],
                    }),
                ),
                stillOpen: Array.from({ length: 25 }, (_value, index) => ({
                    key: `A${index + 1}`,
                    applies: true,
                    evidence: [1, 2, 3, 4, 5].map(quote),
                })),
            },
            FIGURES,
        )
        expect(review.findings).toHaveLength(8)
        expect(review.findings[0]?.evidence).toHaveLength(6)
        expect(review.findings[0]?.relatedRefs).toEqual(["1", "2", "3", "4", "5"])
        expect(review.stillOpen).toHaveLength(20)
        expect(review.stillOpen[0]?.evidence).toHaveLength(3)
    })
})

describe("toReasonedReview drops", () => {
    it("drops evidence without a key and a finding left with none", async () => {
        const subject = await build()
        const review = subject.toReasonedReview(
            {
                findings: [
                    findingOf({ evidence: [{ key: "  ", quote: "x" }] }),
                    findingOf({
                        title: "Giu lai",
                        evidence: [
                            { key: "", quote: "bo" },
                            { key: "F2", quote: "giu" },
                        ],
                    }),
                ],
                stillOpen: [],
            },
            FIGURES,
        )
        expect(review.findings.map((finding) => finding.title)).toEqual(["Giu lai"])
        expect(review.findings[0]?.evidence).toEqual([{ key: "F2", quote: "giu" }])
    })

    it("drops a finding whose title or detail is under three characters once trimmed", async () => {
        const subject = await build()
        const review = subject.toReasonedReview(
            {
                findings: [findingOf({ title: " a " }), findingOf({ detail: "  b  " }), findingOf({ title: "Du dai" })],
                stillOpen: [],
            },
            FIGURES,
        )
        expect(review.findings.map((finding) => finding.title)).toEqual(["Du dai"])
    })

    it("answers a null document type when none is given or it is blank", async () => {
        const subject = await build()
        const review = subject.toReasonedReview(
            {
                findings: [findingOf({ documentType: null }), findingOf({ documentType: "   " })],
                stillOpen: [],
            },
            FIGURES,
        )
        expect(review.findings.map((finding) => finding.documentType)).toEqual([null, null])
    })
})

describe("toRemedyText", () => {
    it("carries a draft with its model", async () => {
        const subject = await build()
        expect(subject.toRemedyText(remedyOf(), "m1")).toEqual({
            title: "Nghi quyet thong qua Dieu le sua doi",
            documentType: "Nghi quyet HDTV",
            body: "# Nghi quyet\n\nNgay [Signing date: dd/mm/yyyy]",
            placeholders: [{ label: "Ngay ky", reason: "Chua co ngay hop" }],
            model: "m1",
        })
    })

    it("trims the body, collapses the title and cuts every text to its bound", async () => {
        const subject = await build()
        const text = subject.toRemedyText(
            remedyOf({
                title: `  ${"t".repeat(200)}`,
                documentType: "x".repeat(100),
                body: `\n${"b".repeat(41_000)}\n`,
                placeholders: [{ label: `  ${"l".repeat(150)}`, reason: "r".repeat(300) }],
            }),
            "m1",
        )
        expect(text?.title).toHaveLength(160)
        expect(text?.documentType).toHaveLength(80)
        expect(text?.body).toHaveLength(40_000)
        expect(text?.placeholders).toEqual([{ label: "l".repeat(120), reason: "r".repeat(200) }])
    })

    it("keeps at most thirty placeholders and drops one without a label", async () => {
        const subject = await build()
        const text = subject.toRemedyText(
            remedyOf({
                placeholders: [
                    { label: "  ", reason: "bo" },
                    ...Array.from({ length: 40 }, (_value, index) => ({ label: `L${index}`, reason: "r" })),
                ],
            }),
            "m1",
        )
        expect(text?.placeholders).toHaveLength(30)
        expect(text?.placeholders[0]).toEqual({ label: "L0", reason: "r" })
    })

    it("answers null when the title is blank", async () => {
        const subject = await build()
        expect(subject.toRemedyText(remedyOf({ title: "   " }), "m1")).toBeNull()
    })

    it("answers null when the body is blank", async () => {
        const subject = await build()
        expect(subject.toRemedyText(remedyOf({ body: " \n " }), "m1")).toBeNull()
    })
})
