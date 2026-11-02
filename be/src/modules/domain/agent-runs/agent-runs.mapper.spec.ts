import { Test } from "@nestjs/testing"
import {
    chainStepRowsOf,
    toldRunRowOf,
    waitingRunRowOf,
    waitingStepRowOf,
} from "@tests/fixtures/builders/agent-runs.builder"
import { handlerViewsOf, routeStepOf, runViewOf, stepViewOf } from "./agent-runs.mapper"

const SUBJECT = Symbol("agent-runs.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { handlerViewsOf, routeStepOf, runViewOf, stepViewOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-runs.mapper")>(SUBJECT)
}

describe("runViewOf", () => {
    it("reads the run with the trigger intact and whether a person was told", async () => {
        const { runViewOf } = await buildSubject()

        expect(runViewOf(waitingRunRowOf())).toEqual({
            id: "run-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "customer_message",
            versionId: "v-1",
            status: "waiting",
            context: { conversationId: "c-1" },
            errorCode: null,
            spoken: false,
        })
        expect(runViewOf(toldRunRowOf()).spoken).toBe(true)
    })
})

describe("stepViewOf and routeStepOf", () => {
    it("reads the step for the trace and the part the failure route needs", async () => {
        const { stepViewOf, routeStepOf } = await buildSubject()
        const view = stepViewOf(waitingStepRowOf())

        expect(view).toMatchObject({ stepKey: "step-1", nodeKey: "node", seq: 1, waitItemId: "item-1", fence: 2 })
        expect(routeStepOf(view)).toEqual({ stepKey: "step-1", seq: 1, status: "done", effect: { kind: "read" } })
    })
})

describe("handlerViewsOf", () => {
    it("gives each step the results of the steps done before it and no others", async () => {
        const { handlerViewsOf } = await buildSubject()

        const views = handlerViewsOf(chainStepRowsOf())

        expect(views.map((view) => view.stepKey)).toEqual(["turn", "read", "door", "out"])
        expect(views[0]?.earlier).toEqual({})
        expect(views[3]?.earlier).toEqual({ turn: { reply: "hi" } })
        expect(views[2]).toMatchObject({ runId: "run-1", attempt: 1, maxAttempts: 3, input: {} })
    })
})
