import { Test } from "@nestjs/testing"
import { LanggraphErrorCode } from "./errors/langgraph.error"
import { requirePlain } from "./plain.policy"

/** The members of the subject under test. */
interface Subject {
    readonly requirePlain: typeof requirePlain
}

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
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
        const bare: unknown = Object.create(null)

        expect(() =>
            subject.requirePlain({ a: 1, b: "x", c: [true, null, { d: undefined }], e: bare }, "state"),
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

        expect(thrownBy(() => subject.requirePlain(value, "state"))).toEqual(objectLike({ code: LanggraphErrorCode.NotPlain, params: { at } }))
    })

    it("refuses a cycle instead of walking it for ever", async () => {
        const subject = await build()
        const loop: Record<string, unknown> = {}
        loop.self = loop

        expect(thrownBy(() => subject.requirePlain(loop, "state"))).toEqual(objectLike({ code: LanggraphErrorCode.NotPlain, params: { at: "state.self" } }))
    })
})
