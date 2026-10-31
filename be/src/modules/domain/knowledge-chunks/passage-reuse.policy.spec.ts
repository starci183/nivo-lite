import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { EmbeddedChunk } from "./knowledge-chunks.contracts"
import { passageHashOf } from "./passage-hash.policy"
import { reusePlanOf } from "./passage-reuse.policy"

const SUBJECT = Symbol("passage-reuse.policy")
const MODEL = "m1"

const rowOf = builder<EmbeddedChunk>({ id: "c0", order: 0, text: "a", hash: passageHashOf("a", MODEL), model: MODEL })

/** A stored passage with its hash. */
const stored = (text: string, order: number, model = MODEL): EmbeddedChunk =>
    rowOf({ id: `c${order}`, order, text, hash: passageHashOf(text, model), model })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { reusePlanOf } }],
    }).compile()
    return moduleRef.get<{ reusePlanOf: typeof reusePlanOf }>(SUBJECT)
}

describe("reusePlanOf", () => {
    it("embeds every piece when nothing is stored", async () => {
        const subject = await build()

        expect(subject.reusePlanOf(["a", "b"], [], MODEL)).toEqual({
            moves: [],
            missing: [
                { order: 0, text: "a" },
                { order: 1, text: "b" },
            ],
        })
    })

    it("plans nothing for an empty text", async () => {
        const subject = await build()

        expect(subject.reusePlanOf([], [stored("a", 0)], MODEL)).toEqual({ moves: [], missing: [] })
    })

    it("keeps a passage that is at its order", async () => {
        const subject = await build()

        expect(subject.reusePlanOf(["a", "b"], [stored("a", 0), stored("b", 1)], MODEL)).toEqual({
            moves: [],
            missing: [],
        })
    })

    it("moves a passage whose text sits elsewhere, keeping its vector", async () => {
        const subject = await build()
        const have = [stored("a", 0), stored("b", 1)]

        expect(subject.reusePlanOf(["new", "a", "b"], have, MODEL)).toEqual({
            moves: [
                { id: "c0", order: 1 },
                { id: "c1", order: 2 },
            ],
            missing: [{ order: 0, text: "new" }],
        })
    })

    it("swaps two passages without embedding either", async () => {
        const subject = await build()
        const have = [stored("a", 0), stored("b", 1)]

        expect(subject.reusePlanOf(["b", "a"], have, MODEL)).toEqual({
            moves: [
                { id: "c1", order: 0 },
                { id: "c0", order: 1 },
            ],
            missing: [],
        })
    })

    it("embeds a passage that changed and keeps the rest", async () => {
        const subject = await build()
        const have = [stored("a", 0), stored("b", 1), stored("c", 2)]

        expect(subject.reusePlanOf(["a", "B changed", "c"], have, MODEL)).toEqual({
            moves: [],
            missing: [{ order: 1, text: "B changed" }],
        })
    })

})

describe("reusePlanOf duplicates, models and passages from before hashes", () => {
    it("lets one stored passage serve one duplicate piece; the other is embedded", async () => {
        const subject = await build()

        expect(subject.reusePlanOf(["a", "a"], [stored("a", 0)], MODEL)).toEqual({
            moves: [],
            missing: [{ order: 1, text: "a" }],
        })
    })

    it("uses each of two duplicate stored passages for its own piece", async () => {
        const subject = await build()
        const have = [stored("a", 0), rowOf({ id: "c1", order: 5 })]

        expect(subject.reusePlanOf(["a", "b", "a"], have, MODEL)).toEqual({
            moves: [{ id: "c1", order: 2 }],
            missing: [{ order: 1, text: "b" }],
        })
    })

    it("takes one of two free passages with the same text and leaves the other", async () => {
        const subject = await build()
        const have = [rowOf({ id: "c8", order: 8 }), rowOf({ id: "c9", order: 9 })]

        expect(subject.reusePlanOf(["a"], have, MODEL)).toEqual({ moves: [{ id: "c8", order: 0 }], missing: [] })
    })

    it("re-embeds every passage when the model changed", async () => {
        const subject = await build()
        const have = [stored("a", 0, "m0"), stored("b", 1, "m0")]

        expect(subject.reusePlanOf(["a", "b"], have, MODEL).missing.map((entry) => entry.order)).toEqual([0, 1])
    })

    it("compares a passage with no hash as before: same order, text and model", async () => {
        const subject = await build()
        const legacy = rowOf({ hash: null, text: "a", order: 0 })

        expect(subject.reusePlanOf(["a"], [legacy], MODEL)).toEqual({ moves: [], missing: [] })
    })

    it.each([
        ["another text", { text: "z" }],
        ["another model", { model: "m0" }],
        ["no model", { model: null }],
    ])("embeds again over a passage with no hash and %s", async (_name, change) => {
        const subject = await build()
        const legacy = rowOf({ hash: null, ...change })

        expect(subject.reusePlanOf(["a"], [legacy], MODEL).missing).toEqual([{ order: 0, text: "a" }])
    })

    it("never moves a passage with no hash", async () => {
        const subject = await build()
        const legacy = rowOf({ hash: null, order: 3 })

        expect(subject.reusePlanOf(["a"], [legacy], MODEL)).toEqual({
            moves: [],
            missing: [{ order: 0, text: "a" }],
        })
    })
})
