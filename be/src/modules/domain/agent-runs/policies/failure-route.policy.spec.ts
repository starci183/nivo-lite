import { Test } from "@nestjs/testing"
import { routeFailure, triesLeft } from "./failure-route.policy"
import { TOOL_OUTCOME_UNKNOWN, backoffMs } from "./agent-runs.policy"
import type { FailureFacts, RouteStep } from "./failure-route.policy"

const SUBJECT = Symbol("failure-route.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { routeFailure, triesLeft } }],
    }).compile()
    return moduleRef.get<typeof import("./failure-route.policy")>(SUBJECT)
}

const read = (seq: number, status: RouteStep["status"] = "done"): RouteStep => ({
    stepKey: `read-${String(seq)}`,
    seq,
    status,
    effect: { kind: "read" },
})

const door = (seq: number, status: RouteStep["status"] = "done"): RouteStep => ({
    stepKey: `door-${String(seq)}`,
    seq,
    status,
    effect: { kind: "compensable", compensation: "close_item" },
})

const pivot = (seq: number, status: RouteStep["status"] = "done"): RouteStep => ({
    stepKey: `pivot-${String(seq)}`,
    seq,
    status,
    effect: { kind: "pivot" },
})

const facts = (over: Partial<FailureFacts> = {}): FailureFacts => ({
    code: "connector_timeout",
    retryable: true,
    attempt: 1,
    maxAttempts: 3,
    steps: [],
    ...over,
})

describe("routeFailure", () => {
    it("retries a retryable failure that has tries left, after the bounded backoff", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ attempt: 2 }))).toEqual({ kind: "retry", afterMs: backoffMs(2) })
    })

    it("stops retrying when the tries are spent, or when the handler said the step cannot succeed", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ attempt: 3 })).kind).not.toBe("retry")
        expect(routeFailure(facts({ retryable: false })).kind).not.toBe("retry")
    })

    it("undoes the done compensable steps in reverse order when no pivot is done", async () => {
        const { routeFailure } = await buildSubject()
        const route = routeFailure(facts({ attempt: 3, steps: [read(1), door(2), door(4), read(5, "running")] }))

        expect(route).toEqual({ kind: "compensate", stepKeys: ["door-4", "door-2"] })
    })

    it("leaves steps that are not done alone", async () => {
        const { routeFailure } = await buildSubject()
        const route = routeFailure(facts({ attempt: 3, steps: [door(1, "pending"), door(2, "failed"), door(3)] }))

        expect(route).toEqual({ kind: "compensate", stepKeys: ["door-3"] })
    })

    it("goes to a person with nothing undone when a pivot is done, naming the last pivot", async () => {
        const { routeFailure } = await buildSubject()
        const route = routeFailure(facts({ attempt: 3, steps: [door(1), pivot(2), pivot(3), read(4, "running")] }))

        expect(route).toEqual({ kind: "person", pivotKey: "pivot-3" })
    })

    it("goes to a person when there is nothing to undo and no pivot", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ attempt: 3, steps: [read(1), read(2, "running")] }))).toEqual({
            kind: "person",
            pivotKey: null,
        })
    })

    it("sends an unknown tool outcome to a person at once, never retried and never undone", async () => {
        const { routeFailure } = await buildSubject()
        const route = routeFailure(facts({ code: TOOL_OUTCOME_UNKNOWN, attempt: 1, steps: [door(1), pivot(2)] }))

        expect(route).toEqual({ kind: "person", pivotKey: "pivot-2" })
        expect(routeFailure(facts({ code: TOOL_OUTCOME_UNKNOWN, steps: [door(1)] }))).toEqual({
            kind: "person",
            pivotKey: null,
        })
    })
})

describe("routeFailure unknown delivery", () => {
    it("waits for a person without retry or compensation when the remote acknowledgement is unknown", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ code: "delivery_outcome_unknown", steps: [door(1)] }))).toEqual({
            kind: "person",
            pivotKey: null,
        })
    })
})

describe("routeFailure for a parked step", () => {
    const parked = (over: Partial<FailureFacts>): FailureFacts => ({
        code: "invalid_step_input",
        retryable: false,
        attempt: 1,
        maxAttempts: 3,
        steps: [door(1)],
        park: true,
        ...over,
    })

    it("gives a failure no other try can cure to a person at once and undoes nothing", async () => {
        const subject = await buildSubject()

        expect(subject.routeFailure(parked({}))).toEqual({ kind: "person", pivotKey: null })
    })

    it("names the pivot that is done when it parks", async () => {
        const subject = await buildSubject()

        expect(subject.routeFailure(parked({ steps: [door(1), pivot(2)] }))).toEqual({
            kind: "person",
            pivotKey: "pivot-2",
        })
    })

    it("still undoes the done steps for a failure that is not parked and has no tries left", async () => {
        const subject = await buildSubject()

        expect(subject.routeFailure(parked({ park: false }))).toEqual({ kind: "compensate", stepKeys: ["door-1"] })
    })
})

describe("routeFailure for a side step", () => {
    it("tries a side step again while it has tries", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ sideStep: true, attempt: 1 }))).toEqual({ kind: "retry", afterMs: backoffMs(1) })
    })

    it("goes on past a side step once no try is left, whatever is done before it and whatever stopped it", async () => {
        const { routeFailure } = await buildSubject()
        expect(routeFailure(facts({ sideStep: true, attempt: 3, steps: [pivot(1)] }))).toEqual({ kind: "continue" })
        expect(routeFailure(facts({ sideStep: true, park: true, steps: [door(1)] }))).toEqual({ kind: "continue" })
        expect(routeFailure(facts({ sideStep: true, retryable: false }))).toEqual({ kind: "continue" })
        expect(routeFailure(facts({ sideStep: true, code: TOOL_OUTCOME_UNKNOWN }))).toEqual({ kind: "continue" })
    })

    it("says no try is left for a park, an unknown outcome, a refusal or spent tries", async () => {
        const { triesLeft } = await buildSubject()
        expect(triesLeft(facts({ attempt: 1 }))).toBe(true)
        expect(triesLeft(facts({ attempt: 3 }))).toBe(false)
        expect(triesLeft(facts({ park: true }))).toBe(false)
        expect(triesLeft(facts({ retryable: false }))).toBe(false)
        expect(triesLeft(facts({ code: TOOL_OUTCOME_UNKNOWN }))).toBe(false)
    })
})
