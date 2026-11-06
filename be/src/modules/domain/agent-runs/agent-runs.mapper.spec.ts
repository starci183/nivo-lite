import { Test } from "@nestjs/testing"
import {
    WHEN,
    runRecordOf as sampleRun,
    runRowOf,
    stepRecordOf as sampleStep,
    stepRowOf,
} from "@tests/fixtures/builders/agent-runs.builder"
import { handlerViewsOf, routeStepOf, runRecordOf, runViewOf, stepRecordOf, stepViewOf } from "./agent-runs.mapper"

const SUBJECT = Symbol("agent-runs.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { handlerViewsOf, routeStepOf, runRecordOf, runViewOf, stepRecordOf, stepViewOf },
            },
        ],
    }).compile()
    return moduleRef.get<{
        handlerViewsOf: typeof handlerViewsOf
        routeStepOf: typeof routeStepOf
        runRecordOf: typeof runRecordOf
        runViewOf: typeof runViewOf
        stepRecordOf: typeof stepRecordOf
        stepViewOf: typeof stepViewOf
    }>(SUBJECT)
}

describe("run records", () => {
    it("reads a run record from the engine row", async () => {
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
    it("reads a step record from the engine row", async () => {
        const { stepRecordOf, stepViewOf } = await buildSubject()
        const step = stepRecordOf(
            stepRowOf({
                effect: { kind: "compensable", compensation: "undo" },
                result: { ok: true },
                claimedUntil: WHEN.toISOString(),
            }),
        )

        expect(step).toMatchObject({ stepKey: "step-1", effect: { kind: "compensable", compensation: "undo" } })
        expect(step.claimedUntil?.toISOString()).toBe(WHEN.toISOString())
        expect(stepViewOf(step)).toMatchObject({ seq: 1, fence: 2, result: { ok: true } })
    })

    it.each([
        [{ kind: "read" }, { kind: "read" }],
        [{ kind: "pivot" }, { kind: "pivot" }],
    ])("reads the effect %j", async (effect, expected) => {
        const { stepRecordOf } = await buildSubject()
        expect(stepRecordOf(stepRowOf({ effect })).effect).toEqual(expected)
    })

    it.each([
        ["an effect of an unknown kind", { effect: { kind: "other" } }],
        ["a compensable effect with no handler", { effect: { kind: "compensable" } }],
        ["a step status it does not know", { status: "limbo" }],
        ["an input that is no object", { input: "x" }],
    ])("refuses %s", async (_name, over) => {
        const { stepRecordOf } = await buildSubject()
        expect(() => stepRecordOf(stepRowOf(over))).toThrow()
    })

    it("hands the failure route only what it reads", async () => {
        const { routeStepOf, stepViewOf } = await buildSubject()
        expect(routeStepOf(stepViewOf(sampleStep({ ordinal: 4, status: "failed" })))).toEqual({
            stepKey: "step-1",
            seq: 4,
            status: "failed",
            effect: { kind: "read" },
        })
    })

    it("gives every step the results of the steps done before it, by step key", async () => {
        const { handlerViewsOf } = await buildSubject()
        const run = sampleRun()
        const views = handlerViewsOf(run, [
            sampleStep({ stepKey: "a", ordinal: 1, result: { x: 1 } }),
            sampleStep({ stepKey: "b", ordinal: 2, status: "running", result: null }),
            sampleStep({ stepKey: "c", ordinal: 3, status: "pending" }),
        ])

        expect(views.map((view) => view.earlier)).toEqual([{}, { a: { x: 1 } }, { a: { x: 1 } }])
        expect(views[1]).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", runId: "run-1", fence: 2 })
    })
})
