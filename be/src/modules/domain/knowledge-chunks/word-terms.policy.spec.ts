import { Test } from "@nestjs/testing"
import {
    CODE_WEIGHT,
    TERMS_MAX,
    candidateGroupsOf,
    isCodeLike,
    isNamingCode,
    totalWeightOf,
    wordTermsOf,
} from "./word-terms.policy"

const SUBJECT = Symbol("word-terms.policy")
type Subject = { wordTermsOf: typeof wordTermsOf; candidateGroupsOf: typeof candidateGroupsOf }

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { wordTermsOf, candidateGroupsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The texts of the terms of a query, in their order. */
const textsOf = (subject: Subject, query: string): ReadonlyArray<string> =>
    subject.wordTermsOf(query).terms.map((term) => term.text)

describe("word terms of a ranked search: what is kept", () => {
    it("keeps every word the caller passed, in its order, once (case aside), without edge punctuation; no word is dropped by a list", async () => {
        const subject = await build()

        expect(textsOf(subject, "SP-0015 chieu cao")).toEqual(["SP-0015", "chieu", "cao"])
        expect(textsOf(subject, "SP-0015 cao bao nhieu?")).toEqual(["SP-0015", "cao", "bao", "nhieu"])
        expect(textsOf(subject, "Hoa hoa (hong)")).toEqual(["Hoa", "hong"])
    })

    it("reads web-search syntax: a quoted phrase must appear, -word excludes, `or` is no term", async () => {
        const subject = await build()

        expect(subject.wordTermsOf('"phi ship" noi thanh -ngoai Noi OR thanh')).toEqual({
            terms: [
                { text: "noi", weight: 1 },
                { text: "thanh", weight: 1 },
            ],
            phrases: ["phi ship"],
            excluded: ["ngoai"],
        })
    })

    it("finds no term in punctuation", async () => {
        const subject = await build()

        expect(subject.wordTermsOf(" ... ? ")).toEqual({ terms: [], phrases: [], excluded: [] })
    })

    it("scores by at most TERMS_MAX terms, a code kept before the later words", async () => {
        const subject = await build()

        const terms = textsOf(subject, "mot hai ba bon nam sau bay tam chin muoi SP-0001")

        expect(terms).toEqual(["mot", "hai", "ba", "bon", "nam", "sau", "bay", "SP-0001"])
        expect(terms).toHaveLength(TERMS_MAX)
    })
})

describe("word terms of a ranked search: weights and candidates", () => {
    it("weighs a code or a long number three words and keeps the order of the query; a short number is a word", async () => {
        const subject = await build()

        const terms = subject.wordTermsOf("ton kho SP-0003 CN2 2026-09-07").terms

        expect(terms.map((term) => term.weight)).toEqual([1, 1, CODE_WEIGHT, CODE_WEIGHT, CODE_WEIGHT])
        expect(totalWeightOf(terms)).toBe(11)
        expect(["DH-2026-012346", "630000", "15.000", "99", "5"].map((word) => isCodeLike(word))).toEqual([true, true, true, false, false])
        // Only a code that names one thing makes a candidate alone: a date, a price or a branch code is shared by thousands of rows.
        expect(["SP-0003", "DH-2026-012346", "0071001234567", "CN2", "2026-09-07", "630000"].map((word) => isNamingCode(word))).toEqual(
            [true, true, true, false, false, false],
        )
    })

    it("asks a candidate for a naming code alone, else two neighbouring words side by side with half of the rest", async () => {
        const subject = await build()
        const groupsOf = (query: string) => subject.candidateGroupsOf(subject.wordTermsOf(query).terms)

        expect(groupsOf("ton kho SP-0003 2026-09-07")).toEqual([[[2]]])
        expect(groupsOf("sen da")).toEqual([[[0, 1]]])
        expect(groupsOf("mau don nu no")).toEqual([
            [[0, 1], [2]],
            [[0, 1], [3]],
            [[1, 2], [0]],
            [[1, 2], [3]],
            [[2, 3], [0]],
            [[2, 3], [1]],
        ])
        expect(groupsOf("CN2 2026-09-07")).toEqual([[[0, 1]]])
        expect(groupsOf("hoa")).toEqual([[[0]]])
        expect(subject.candidateGroupsOf([])).toEqual([])
    })

    it("stays bounded for the longest query: at most 7 pairs times 20 picks", async () => {
        const subject = await build()

        const groups = subject.candidateGroupsOf(subject.wordTermsOf("gio hoa cam on size L giay goi mau").terms)

        expect(groups).toHaveLength(140)
        expect(groups.every((group) => group.length === 4)).toBe(true)
    })
})
