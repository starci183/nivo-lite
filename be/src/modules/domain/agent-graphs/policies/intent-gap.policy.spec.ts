import { Test } from "@nestjs/testing"
import { gapKeyOf } from "./intent-gap.policy"

const SUBJECT = Symbol("intent-gap.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { gapKeyOf } }],
    }).compile()
    return moduleRef.get<{ gapKeyOf: typeof gapKeyOf }>(SUBJECT)
}

describe("gapKeyOf", () => {
    it("is the same key however the question is cased, accented, spaced or punctuated", async () => {
        const subject = await build()

        const keys = ["Caf\u00e9 open on Sunday?", "  cafe open   on sunday ", "CAFE\u0301 OPEN ON SUNDAY!!!"].map(
            subject.gapKeyOf,
        )

        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toBe("gap:cafe open on sunday")
    })

    it("keeps the d with a stroke as a d and tells two questions apart", async () => {
        const subject = await build()

        expect(subject.gapKeyOf("\u0110\u1eb7t c\u1ecdc bao nhi\u00eau")).toBe("gap:dat coc bao nhieu")
        expect(subject.gapKeyOf("Open on Sunday?")).not.toBe(subject.gapKeyOf("Open on Monday?"))
    })

    it("bounds the key", async () => {
        const subject = await build()

        expect(subject.gapKeyOf("a".repeat(500))).toHaveLength("gap:".length + 160)
    })
})
