import { Test } from "@nestjs/testing"
import { DOCUMENT_RUN, spreadByDocument, type SpreadHit } from "./passage-spread.policy"

const SUBJECT = Symbol("passage-spread.policy")
type Subject = typeof import("./passage-spread.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: (): Subject => ({ DOCUMENT_RUN, spreadByDocument }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** A ranked hit: its id, its document and whether it holds every word of the query. */
interface Hit extends SpreadHit {
    readonly id: string
}

const hit = (id: string, document: string, complete = false): Hit => ({ id, document, complete })
const read = (one: Hit): SpreadHit => one
const idsOf = (hits: ReadonlyArray<Hit>): ReadonlyArray<string> => hits.map((one) => one.id)

describe("passage-spread.policy: no document fills a page of hits (Round W, D-W-3)", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("lets one bulk document take three places, then the other documents, then the rest of the bulk in its own order", () => {
        const ranked = [
            hit("bulk-1", "bulk"),
            hit("bulk-2", "bulk"),
            hit("bulk-3", "bulk"),
            hit("bulk-4", "bulk"),
            hit("bulk-5", "bulk"),
            hit("bulk-6", "bulk"),
            hit("catalogue-1", "catalogue"),
            hit("letters-1", "letters"),
        ]

        expect(idsOf(subject.spreadByDocument(ranked, read))).toEqual([
            "bulk-1",
            "bulk-2",
            "bulk-3",
            "catalogue-1",
            "letters-1",
            "bulk-4",
            "bulk-5",
            "bulk-6",
        ])
    })

    it("keeps the hits that hold every word ahead of all the others, each group spread on its own", () => {
        const ranked = [
            hit("orders-1", "orders", true),
            hit("orders-2", "orders", true),
            hit("orders-3", "orders", true),
            hit("prices-1", "prices", true),
            hit("stock-1", "stock"),
            hit("stock-2", "stock"),
            hit("stock-3", "stock"),
            hit("guide-1", "guide"),
        ]

        expect(idsOf(subject.spreadByDocument(ranked, read, 2))).toEqual([
            "orders-1",
            "orders-2",
            "prices-1",
            "orders-3",
            "stock-1",
            "stock-2",
            "guide-1",
            "stock-3",
        ])
    })

    it("changes nothing when no document holds more than its run, and answers every hit exactly once", () => {
        const ranked = [hit("a-1", "a"), hit("b-1", "b"), hit("a-2", "a"), hit("c-1", "c"), hit("b-2", "b")]

        const spread = subject.spreadByDocument(ranked, read)

        expect(idsOf(spread)).toEqual(idsOf(ranked))
        expect(new Set(idsOf(spread)).size).toBe(ranked.length)
    })

    it("takes a run of one as one hit per document a round, and a run below one as one", () => {
        const ranked = [hit("a-1", "a"), hit("a-2", "a"), hit("b-1", "b"), hit("a-3", "a"), hit("b-2", "b")]

        expect(idsOf(subject.spreadByDocument(ranked, read, 1))).toEqual(["a-1", "b-1", "a-2", "b-2", "a-3"])
        expect(idsOf(subject.spreadByDocument(ranked, read, 0))).toEqual(["a-1", "b-1", "a-2", "b-2", "a-3"])
    })

    it("answers nothing for no hit, and takes three places per document by default: half of the default page", () => {
        expect(subject.spreadByDocument([], read)).toEqual([])
        expect(subject.DOCUMENT_RUN).toBe(3)
    })
})
