import { Test } from "@nestjs/testing"
import { TRUTH_READS_MAX, truthReadsOf } from "./truth-reads.policy"

const SUBJECT = Symbol("truth-reads.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { truthReadsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./truth-reads.policy")>(SUBJECT)
}

describe("truthReadsOf: the truths a read of the truth graph served", () => {
    it("reads a search or a list (facts), a get (fact) and a relation read (fact + related[].fact), each truth once, in order", async () => {
        const subject = await build()

        expect(
            subject.truthReadsOf({
                fact: { id: "f0", v: 1 },
                facts: [
                    { id: "f1", v: 3, value: "30.000" },
                    { id: "f1", v: 3 },
                ],
                related: [{ relation: "part_of", fact: { id: "f2", v: 2 } }, { relation: "related" }],
            }),
        ).toEqual([
            { factId: "f1", version: 3 },
            { factId: "f0", version: 1 },
            { factId: "f2", version: 2 },
        ])
    })

    it("keeps ids and versions only, a version that is no whole number as null, and nothing that is not a truth line", async () => {
        const subject = await build()

        expect(
            subject.truthReadsOf({ facts: [{ id: "f1", v: 1.5 }, { id: "" }, "f2", null, { v: 2 }], passages: [{ id: "p1", v: 1 }] }),
        ).toEqual([{ factId: "f1", version: null }])
        expect(subject.truthReadsOf([] as never)).toEqual([])
    })

    it("keeps at most the bound of one line", async () => {
        const subject = await build()

        const facts = Array.from({ length: TRUTH_READS_MAX + 5 }, (_, index) => ({ id: `f${String(index)}`, v: 1 }))

        expect(subject.truthReadsOf({ facts })).toHaveLength(TRUTH_READS_MAX)
    })
})
