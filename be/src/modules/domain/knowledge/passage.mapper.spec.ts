import { Test } from "@nestjs/testing"
import type { PassageFound } from "./passage-retrieval.contracts"
import { UNREVIEWED_MARK, businessPassage, nivoPassage, rankPassages, tsqueryOf } from "./passage.mapper"

const SUBJECT = Symbol("passage.mapper")
type Subject = {
    businessPassage: typeof businessPassage
    nivoPassage: typeof nivoPassage
    rankPassages: typeof rankPassages
    tsqueryOf: typeof tsqueryOf
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { businessPassage, nivoPassage, rankPassages, tsqueryOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const chunk: PassageFound = {
    id: "c1",
    sourceId: "s1",
    title: "Hours",
    updatedAt: "2026-11-02T00:00:00.000Z",
    documentPassages: 4,
    order: 2,
    place: null,
    module: "chatbot",
    visibility: "public",
    customerReady: true,
    legs: ["words"],
    score: 0.5,
    content: "Open 8 to 21",
}
const item = { id: "n1", module: "core", kind: "tone", title: "Tone", content: "Be kind", score: 0.7 }

describe("passage mapping", () => {
    it("joins a business hit with the brief of its source", async () => {
        const subject = await build()

        expect(subject.businessPassage(chunk, { id: "s1", kind: "faq", title: "Hours", topic: "hours" })).toEqual({
            layer: "business",
            id: "c1",
            sourceId: "s1",
            module: "chatbot",
            kind: "faq",
            title: "Hours",
            content: "Open 8 to 21",
            score: 0.5,
            visibility: "public",
            topic: "hours",
            order: 2,
            unreviewed: false,
        })
    })

    it("marks a passage the critic has not released to customers yet, for the internal reader (trust gate)", async () => {
        const subject = await build()

        expect(
            subject.businessPassage({ ...chunk, customerReady: false }, { id: "s1", kind: "faq", title: "Hours", topic: null }),
        ).toMatchObject({ content: `${UNREVIEWED_MARK} Open 8 to 21`, unreviewed: true })
    })

    it("reads a base knowledge hit as an internal passage without a source", async () => {
        const subject = await build()

        expect(subject.nivoPassage(item)).toEqual({
            layer: "nivo",
            id: "n1",
            sourceId: null,
            module: "core",
            kind: "tone",
            title: "Tone",
            content: "Be kind",
            score: 0.7,
            visibility: "internal",
            topic: null,
            order: null,
        })
    })

    it("ranks both layers by score, keeps at most the limit and always at least one", async () => {
        const subject = await build()
        const business = [subject.businessPassage(chunk, { id: "s1", kind: "faq", title: "Hours", topic: null })]

        expect(subject.rankPassages(business, [item], 8).map((passage) => passage.id)).toEqual(["n1", "c1"])
        expect(subject.rankPassages(business, [item], 1).map((passage) => passage.id)).toEqual(["n1"])
        expect(subject.rankPassages(business, [item], 0)).toHaveLength(1)
        expect(subject.rankPassages([], [], 5)).toEqual([])
    })

    it("builds the tsquery of the folded words, or none", async () => {
        const subject = await build()

        expect(subject.tsqueryOf("opening  hours? 24h")).toBe("opening | hours | 24h")
        expect(subject.tsqueryOf(" ?! ")).toBeNull()
    })
})
