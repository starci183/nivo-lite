import { Test } from "@nestjs/testing"
import { partOriginOf, partTitleOf, partsOf } from "./source-parts.policy"

const SUBJECT = Symbol("source-parts.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { partOriginOf, partTitleOf, partsOf } }],
    }).compile()
    return moduleRef.get<{
        partOriginOf: typeof partOriginOf
        partTitleOf: typeof partTitleOf
        partsOf: typeof partsOf
    }>(SUBJECT)
}

describe("partsOf", () => {
    it("keeps a text that fits as one part, unchanged", async () => {
        const subject = await build()

        expect(subject.partsOf("a\nb", 10)).toEqual(["a\nb"])
    })

    it("cuts a long text at line ends, every part within the limit and no line lost", async () => {
        const subject = await build()
        const lines = Array.from({ length: 30 }, (_, index) => `row ${index} | cell`)
        const parts = subject.partsOf(lines.join("\n"), 100)

        expect(parts.length).toBeGreaterThan(1)
        expect(parts.every((part) => part.length <= 100)).toBe(true)
        expect(parts.join("\n").split("\n")).toEqual(lines)
    })

    it("cuts a single line longer than the limit where it must be", async () => {
        const subject = await build()

        expect(subject.partsOf("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)])
    })
})

describe("partTitleOf and partOriginOf", () => {
    it("names the place of a part and never stacks a second suffix", async () => {
        const subject = await build()

        expect(subject.partTitleOf("Action plan", 2, 3)).toBe("Action plan (2/3)")
        expect(subject.partTitleOf("Action plan (1/3)", 3, 3)).toBe("Action plan (3/3)")
    })

    it("marks the later parts with the id of the first", async () => {
        const subject = await build()

        expect(subject.partOriginOf("s1")).toBe("part:s1")
    })
})
