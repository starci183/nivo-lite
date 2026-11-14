import { Test } from "@nestjs/testing"
import { WHEN, runRowOf, stepRowOf } from "@tests/fixtures/builders/agent-runs.builder"
import { runEngineOf, runRecordOf, runViewOf, stepRecordOf } from "./agent-runs.mapper"

const SUBJECT = Symbol("agent-runs.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    runEngineOf,
                    runRecordOf,
                    runViewOf,
                    stepRecordOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        runEngineOf: typeof runEngineOf
        runRecordOf: typeof runRecordOf
        runViewOf: typeof runViewOf
        stepRecordOf: typeof stepRecordOf
    }>(SUBJECT)
}

describe("run records", () => {
    it("reads a run record from its stored row", async () => {
        const { runRecordOf, runViewOf } = await buildSubject()
        const run = runRecordOf(
            runRowOf({ error: { code: "boom" }, deadLetteredAt: WHEN.toISOString(), status: "parked" }),
        )

        expect(run).toMatchObject({ id: "run-1", status: "parked", errorCode: "boom", stepSeq: 0 })
        expect(run.deadLetteredAt?.toISOString()).toBe(WHEN.toISOString())
        expect(runViewOf(run)).toMatchObject({ spoken: true, versionId: null, errorCode: "boom" })
    })

    it("reads no error code from a run without an error object or with a code that is no text", async () => {
        const { runRecordOf } = await buildSubject()
        expect(runRecordOf(runRowOf()).errorCode).toBeNull()
        expect(runRecordOf(runRowOf({ error: { code: 3 } })).errorCode).toBeNull()
    })

    it("reads the engine a run is on: the one its row names", async () => {
        const { runEngineOf } = await buildSubject()
        expect(runEngineOf(runRowOf({ engine: "legacy" }))).toBe("legacy")
        expect(runEngineOf(runRowOf({ engine: "langgraph" }))).toBe("langgraph")
        expect(() => runEngineOf(runRowOf({ engine: "unknown-engine" }))).toThrow()
    })

    it.each([
        ["a field that is no text", { agentId: 4 }],
        ["a field that is no number", { stepSeq: "1" }],
        ["a field that is no flag", { planning: "no" }],
        ["a context that is no object", { context: "x" }],
        ["a status the capability does not know", { status: "limbo" }],
    ])("refuses %s", async (_name, over) => {
        const { runRecordOf } = await buildSubject()
        expect(() => runRecordOf(runRowOf(over))).toThrow()
    })
})

describe("step records", () => {
    it("reads a step record from its stored row", async () => {
        const { stepRecordOf } = await buildSubject()
        const step = stepRecordOf(
            stepRowOf({
                effect: { kind: "compensable", compensation: "undo" },
                result: { ok: true },
                claimedUntil: WHEN.toISOString(),
            }),
        )

        expect(step).toMatchObject({ stepKey: "step-1", effect: { kind: "compensable", compensation: "undo" } })
        expect(step.claimedUntil?.toISOString()).toBe(WHEN.toISOString())
        expect(step).toMatchObject({ ordinal: 1, version: "2", result: { ok: true } })
    })

    it.each([
        [{ kind: "read" }, { kind: "read" }],
        [{ kind: "pivot" }, { kind: "pivot" }],
    ])("reads the effect %j", async (effect, expected) => {
        const { stepRecordOf } = await buildSubject()
        expect(stepRecordOf(stepRowOf({ effect })).effect).toEqual(expected)
    })

    it.each([null, undefined])(
        "reads a step row that names no deadline (%s: a thread's step row, D-P10-6) with the default deadline",
        async (deadlineMs) => {
            const { stepRecordOf } = await buildSubject()
            expect(stepRecordOf(stepRowOf({ deadlineMs })).deadlineMs).toBe(120_000)
        },
    )

    it.each([
        ["a deadline that is no number", { deadlineMs: "soon" }],
        ["an effect of an unknown kind", { effect: { kind: "other" } }],
        ["a compensable effect with no handler", { effect: { kind: "compensable" } }],
        ["a step status it does not know", { status: "limbo" }],
        ["an input that is no object", { input: "x" }],
    ])("refuses %s", async (_name, over) => {
        const { stepRecordOf } = await buildSubject()
        expect(() => stepRecordOf(stepRowOf(over))).toThrow()
    })
})
