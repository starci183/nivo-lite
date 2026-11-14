import { Test } from "@nestjs/testing"
import { LanggraphErrorCode } from "./errors/langgraph.error"
import type { ThreadRef } from "./langgraph.port"
import { heldOf, mergeSteps, openingOf, stopOf, writesOf } from "./thread-state.policy"

/** The members of the subject under test. */
interface Subject {
    readonly heldOf: typeof heldOf
    readonly mergeSteps: typeof mergeSteps
    readonly openingOf: typeof openingOf
    readonly stopOf: typeof stopOf
    readonly writesOf: typeof writesOf
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

const SUBJECT = Symbol("thread-state.policy")
const THREAD: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { heldOf, mergeSteps, openingOf, stopOf, writesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("thread-state.policy", () => {
    it("opens a thread with the trigger, every other key empty, and the engine's marks", async () => {
        const subject = await build()

        expect(subject.openingOf({ trigger: { tag: "t" } }, { pin: "v1", cursor: "greet" })).toEqual({
            trigger: { tag: "t" },
            steps: {},
            trouble: null,
            founderAnswers: [],
            loop: null,
            pin: "v1",
            cursor: "greet",
        })
    })

    it("writes only the keys an update names, a null included", async () => {
        const subject = await build()

        expect(subject.writesOf(undefined)).toEqual({})
        expect(subject.writesOf({ trouble: null, steps: { a: 1 } })).toEqual({ trouble: null, steps: { a: 1 } })
        expect(subject.writesOf({ founderAnswers: [], loop: undefined })).toEqual({ founderAnswers: [] })
    })

    it("merges steps by node key", async () => {
        const subject = await build()

        expect(subject.mergeSteps({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 })
    })

    it("reads the values of a checkpoint as the state and the marks, filling what an older thread lacks", async () => {
        const subject = await build()

        expect(subject.heldOf({ pin: "v1", cursor: "a", steps: { a: 1 }, trigger: "t", extra: true }, THREAD)).toEqual({
            state: { trigger: "t", steps: { a: 1 }, trouble: null, founderAnswers: [], loop: null },
            marks: { pin: "v1", cursor: "a" },
        })
    })

    it.each([
        ["nothing", undefined],
        ["no pin", { cursor: "a", steps: {} }],
        ["no cursor", { pin: "v1", steps: {} }],
        ["no step record", { pin: "v1", cursor: "a" }],
    ])("refuses values with %s as not a thread of this engine", async (_name, values) => {
        const subject = await build()

        expect(thrownBy(() => subject.heldOf(values, THREAD))).toEqual(objectLike({ code: LanggraphErrorCode.ThreadUnreadable, params: { thread: "run-1" } }))
    })

    it("reads a stop from the library's interrupt records, one or a list", async () => {
        const subject = await build()
        const record = { id: "i-1", value: { node: "__freeze", question: { ask: 1 } } }

        expect(subject.stopOf([record])).toEqual({ node: "__freeze", question: { ask: 1 } })
        expect(subject.stopOf(record)).toEqual({ node: "__freeze", question: { ask: 1 } })
        expect(subject.stopOf([{ id: "i-2", value: "not ours" }])).toBeNull()
        expect(subject.stopOf(undefined)).toBeNull()
    })
})
