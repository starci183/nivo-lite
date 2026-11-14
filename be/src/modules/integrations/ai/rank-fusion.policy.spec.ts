import { Test } from "@nestjs/testing"
import { FUSION_K, fuseRanks, topScoreOf } from "./rank-fusion.policy"

const SUBJECT = Symbol("rank-fusion.policy")
type Subject = { fuseRanks: typeof fuseRanks; topScoreOf: typeof topScoreOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fuseRanks, topScoreOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("rank fusion", () => {
    it("puts an item both lists hold above one a single list ranks first", async () => {
        const subject = await build()

        const fused = subject.fuseRanks([
            ["code", "both", "w3"],
            ["near", "both", "m3"],
        ])

        expect(fused.map((entry) => entry.id)).toEqual(["both", "code", "near", "m3", "w3"])
        expect(fused[0]).toEqual({ id: "both", ranks: [2, 2], score: 2 / (FUSION_K + 2) })
        expect(fused[1]).toEqual({ id: "code", ranks: [1, null], score: 1 / (FUSION_K + 1) })
    })

    it("orders ties by id, so two fusions of the same lists agree", async () => {
        const subject = await build()
        const lists = [["b", "a"], ["a", "b"]]

        const first = subject.fuseRanks(lists).map((entry) => entry.id)

        expect(first).toEqual(["a", "b"])
        expect(subject.fuseRanks(lists).map((entry) => entry.id)).toEqual(first)
    })

    it("counts an id once per list, at its first place, and fuses nothing from nothing", async () => {
        const subject = await build()

        expect(subject.fuseRanks([["a", "a", "b"]])).toEqual([
            { id: "a", ranks: [1], score: 1 / (FUSION_K + 1) },
            { id: "b", ranks: [3], score: 1 / (FUSION_K + 3) },
        ])
        expect(subject.fuseRanks([[], []])).toEqual([])
    })

    it("weighs one place of an id in a list as asked, and only that place", async () => {
        const subject = await build()

        const fused = subject.fuseRanks([["exact", "w2"], ["m1", "exact"]], FUSION_K, (list, id) => (list === 0 && id === "exact" ? 2 : 1))

        expect(fused[0]).toEqual({ id: "exact", ranks: [1, 2], score: 2 / (FUSION_K + 1) + 1 / (FUSION_K + 2) })
        expect(fused.map((entry) => entry.id)).toEqual(["exact", "m1", "w2"])
    })

    it("names the best score reachable: first place in every list", async () => {
        const subject = await build()

        expect(subject.topScoreOf(2)).toBe(subject.fuseRanks([["a"], ["a"]])[0]?.score)
    })
})
