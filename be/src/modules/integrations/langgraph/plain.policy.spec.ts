import { Test } from "@nestjs/testing"
import { LanggraphErrorCode } from "./errors/langgraph.error"
import { requirePlain } from "./plain.policy"

/** The members of the subject under test. */
interface Subject {
    readonly requirePlain: typeof requirePlain
}

const SUBJECT = Symbol("plain.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requirePlain } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("plain.policy", () => {
    it("lets plain JSON through, an undefined field included", async () => {
        const subject = await build()

        expect(() =>
            subject.requirePlain({ a: 1, b: "x", c: [true, null, { d: undefined }], e: Object.create(null) }, "state"),
        ).not.toThrow()
    })

    it.each([
        ["a Date", { when: new Date(0) }, "state.when"],
        ["a Map", { rows: [new Map()] }, "state.rows[0]"],
        ["a function", { run: (): number => 1 }, "state.run"],
        ["a bigint", { n: 1n }, "state.n"],
        ["a number that is not finite", { n: Number.NaN }, "state.n"],
        ["an undefined in a list", { list: [undefined] }, "state.list[0]"],
        ["an Error", new Error("x"), "state"],
    ])("refuses %s and names where it is, never what it holds", async (_name, value, at) => {
        const subject = await build()

        expect(() => subject.requirePlain(value, "state")).toThrow(
            expect.objectContaining({ code: LanggraphErrorCode.NotPlain, params: { at } }),
        )
    })

    it("refuses a cycle instead of walking it for ever", async () => {
        const subject = await build()
        const loop: Record<string, unknown> = {}
        loop.self = loop

        expect(() => subject.requirePlain(loop, "state")).toThrow(
            expect.objectContaining({ code: LanggraphErrorCode.NotPlain, params: { at: "state.self" } }),
        )
    })
})
