import { Test } from "@nestjs/testing"
import { commitParameters } from "./commit-params.policy"
import { stepSpecOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"

const SUBJECT = Symbol("commit-params.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { commitParameters } }],
    }).compile()
    return moduleRef.get<typeof import("./commit-params.policy")>(SUBJECT)
}

const step = stepViewOf({ runId: "run-9", stepKey: "door", fence: 7 })

describe("commitParameters", () => {
    it("names the run, the step and the fence first, so a stale claim is refused by the function", async () => {
        const { commitParameters } = await buildSubject()
        expect(commitParameters(step, { kind: "failed", code: "x" }).slice(0, 3)).toEqual(["run-9", "door", 7])
    })

    it("carries the result of a done step as JSON text and says whether steps follow", async () => {
        const { commitParameters } = await buildSubject()
        expect(commitParameters(step, { kind: "done", result: { ok: true }, next: [] })).toEqual([
            "run-9",
            "door",
            7,
            "done",
            JSON.stringify({ ok: true }),
            null,
            0,
            null,
            null,
            false,
        ])
        expect(commitParameters(step, { kind: "done", result: {}, next: [stepSpecOf()] })[9]).toBe(true)
    })

    it("carries the work item and the deadline of a wait", async () => {
        const { commitParameters } = await buildSubject()
        const deadlineAt = new Date("2026-11-01T10:00:00Z")

        expect(commitParameters(step, { kind: "wait", workItemId: "item-1", deadlineAt })).toEqual([
            "run-9",
            "door",
            7,
            "wait",
            null,
            null,
            0,
            "item-1",
            deadlineAt,
            false,
        ])
    })

    it("carries the code and the pause in whole seconds of a retry", async () => {
        const { commitParameters } = await buildSubject()
        expect(commitParameters(step, { kind: "retry", code: "slow", afterMs: 2500 })).toEqual([
            "run-9",
            "door",
            7,
            "retry",
            null,
            "slow",
            3,
            null,
            null,
            false,
        ])
    })

    it("carries the code of a failure", async () => {
        const { commitParameters } = await buildSubject()
        expect(commitParameters(step, { kind: "failed", code: "bad" })).toEqual([
            "run-9",
            "door",
            7,
            "failed",
            null,
            "bad",
            0,
            null,
            null,
            false,
        ])
    })
})
