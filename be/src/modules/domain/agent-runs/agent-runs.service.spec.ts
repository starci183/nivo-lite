import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { runStepViewOf, runViewOf, stepSpecOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunInflightService } from "./agent-run-inflight.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { AgentRunsErrorCode } from "./errors/agent-runs.error"
import type { AgentStepHandler } from "./agent-runs.contracts"
import type { ClaimResult, StepEnd } from "./agent-runs-engine.contracts"

const SIGNAL = new AbortController().signal

const build = async (
    claims: ReadonlyArray<ClaimResult>,
    ends: ReadonlyArray<StepEnd> = [],
    handler: AgentStepHandler | undefined = undefined,
    closed = false,
) => {
    const em = mockEntityManager()
    fakeTransaction(em)
    const ledger = mock<AgentStepLedgerService>()
    claims.forEach((claim) => ledger.claim.mockResolvedValueOnce(claim))
    const steps = mock<AgentRunStepsService>()
    ends.forEach((end) => {
        steps.execute.mockResolvedValueOnce(end)
        steps.fail.mockResolvedValueOnce(end)
    })
    const store = mock<AgentRunStoreService>({
        runById: jest.fn().mockResolvedValue(runViewOf()),
        runOfWake: jest.fn().mockResolvedValue(runViewOf()),
        runIn: jest.fn().mockResolvedValue(runViewOf()),
        append: jest.fn().mockResolvedValue(1),
        open: jest.fn().mockResolvedValue(runViewOf()),
        resume: jest.fn().mockResolvedValue(true),
        stepsOf: jest.fn().mockResolvedValue([]),
        viewsOf: jest.fn().mockResolvedValue([]),
        waitingOn: jest.fn().mockResolvedValue(stepViewOf({ kind: "ask" })),
    })
    const compensation = mock<AgentRunCompensationService>({ run: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentRunStoreService, useValue: store },
            {
                provide: AgentRunInflightService,
                useValue: mock<AgentRunInflightService>({
                    closed,
                    track: jest.fn((_step: unknown, work: () => Promise<never>) => work()),
                }),
            },
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>({ of: jest.fn(() => handler) }) },
            { provide: AgentStepLedgerService, useValue: ledger },
            { provide: AgentRunStepsService, useValue: steps },
            { provide: AgentRunCompensationService, useValue: compensation },
        ],
    }).compile()
    return { service: container.get(AgentRunsService), em, ledger, steps, store, compensation }
}

const claimed = (stepKey: string): ClaimResult => ({ kind: "claimed", step: stepViewOf({ stepKey }) })

const DONE: StepEnd = { kind: "done", result: { ok: true } }

const refusal = (code: string) => ({ code: AgentRunsErrorCode.StepFailed, params: { code } })

describe("AgentRunsService.open and append", () => {
    it("opens the one run of a wake through the store", async () => {
        const { service, store, em } = await build([])
        const input = {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "customer_message",
            versionId: null,
            context: {},
        }

        await expect(service.open(em, input)).resolves.toMatchObject({ id: "run-1" })
        expect(store.open).toHaveBeenCalledWith(em, input)
    })

    it("writes steps behind the last one with the workspace of the run", async () => {
        const { service, store, em } = await build([])
        const specs = [stepSpecOf()]

        await service.append(em, "run-1", specs)

        expect(store.append).toHaveBeenCalledWith(em, { runId: "run-1", workspaceId: "ws-1" }, specs)
    })

    it("writes nothing and reads nothing for no steps", async () => {
        const { service, store, em } = await build([])

        await service.append(em, "run-1", [])

        expect(store.runIn).not.toHaveBeenCalled()
        expect(store.append).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.advance", () => {
    it("drives the pending steps in order until the run has none", async () => {
        const { service, steps, ledger } = await build([claimed("a"), claimed("b"), { kind: "idle" }], [DONE, DONE])

        await expect(service.advance("run-1", SIGNAL)).resolves.toEqual({ run: runViewOf(), retryAfterMs: null })

        expect(steps.execute).toHaveBeenCalledTimes(2)
        expect(ledger.claim).toHaveBeenCalledWith("run-1", null)
    })

    it("stops at a step that waits, fails or was fenced", async () => {
        for (const end of [
            { kind: "wait", workItemId: "item-1" },
            { kind: "failed", code: "x" },
            { kind: "fenced" },
        ] satisfies ReadonlyArray<StepEnd>) {
            const { service, ledger } = await build([claimed("a"), claimed("b")], [end])

            await service.advance("run-1", SIGNAL)

            expect(ledger.claim).toHaveBeenCalledTimes(1)
        }
    })

    it("answers how long a step is held by its backoff", async () => {
        const { service } = await build([{ kind: "later", retryAfterMs: 4000 }])

        await expect(service.advance("run-1", SIGNAL)).resolves.toMatchObject({ retryAfterMs: 4000 })
    })

    it("gives a step whose tries are spent to the failure route as a timeout", async () => {
        const step = stepViewOf({ attempt: 3 })
        const { service, steps } = await build([{ kind: "exhausted", step }], [{ kind: "failed", code: "step_timeout" }])

        await service.advance("run-1", SIGNAL)

        expect(steps.fail).toHaveBeenCalledWith(step, "step_timeout", false, SIGNAL)
    })

    it("continues an undo in progress when the run is closed to forward steps", async () => {
        const { service, compensation, steps } = await build([{ kind: "closed" }])

        await service.advance("run-1", SIGNAL)

        expect(compensation.run).toHaveBeenCalledWith("run-1", SIGNAL)
        expect(steps.execute).not.toHaveBeenCalled()
    })

    it("leaves a busy, idle or gone run alone", async () => {
        for (const kind of ["busy", "idle", "gone"] as const) {
            const { service, steps, compensation } = await build([{ kind }])

            await service.advance("run-1", SIGNAL)

            expect(steps.execute).not.toHaveBeenCalled()
            expect(compensation.run).not.toHaveBeenCalled()
        }
    })

    it("hands the rest to a job after the bounded number of steps, and runs nothing once aborted", async () => {
        const many = Array.from({ length: 60 }, (_, index) => claimed(`s-${String(index)}`))
        const bounded = await build(many, Array.from({ length: 60 }, () => DONE))
        await bounded.service.advance("run-1", SIGNAL)
        const stop = new AbortController()
        stop.abort()
        const aborted = await build([claimed("a")])
        await aborted.service.advance("run-1", stop.signal)

        expect(bounded.steps.execute).toHaveBeenCalledTimes(50)
        expect(aborted.ledger.claim).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.runInline", () => {
    it("adds the step to the run of the wake, runs it now and answers its result", async () => {
        const { service, steps, store, ledger } = await build([claimed("tool-1")], [DONE])
        const spec = stepSpecOf()

        await expect(service.runInline("wake-1", spec, SIGNAL)).resolves.toEqual({ ok: true })

        expect(store.append).toHaveBeenCalledWith(expect.anything(), { runId: "run-1", workspaceId: "ws-1" }, [spec])
        expect(ledger.claim).toHaveBeenCalledWith("run-1", "tool-1")
        expect(steps.execute).toHaveBeenCalledTimes(1)
    })

    it("answers the stored result of a step done before, without calling the handler", async () => {
        const { service, steps } = await build([{ kind: "done", answer: { id: "order-1" } }])

        await expect(service.runInline("wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({ id: "order-1" })
        expect(steps.execute).not.toHaveBeenCalled()
    })

    it("answers an empty result for a done step that stored none", async () => {
        const { service } = await build([{ kind: "done", answer: null }])

        await expect(service.runInline("wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({})
    })

    it("answers that the step waits for a person", async () => {
        const { service } = await build([claimed("tool-1")], [{ kind: "wait", workItemId: "item-1" }])

        await expect(service.runInline("wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({
            waiting: true,
            workItemId: "item-1",
        })
    })

    it("throws with the code of a step that did not finish", async () => {
        const failed = await build([claimed("tool-1")], [{ kind: "failed", code: "connector_timeout" }])
        const fenced = await build([claimed("tool-1")], [{ kind: "fenced" }])
        const exhausted = await build([{ kind: "exhausted", step: stepViewOf() }], [{ kind: "failed", code: "step_timeout" }])

        await expect(failed.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("connector_timeout"))
        await expect(fenced.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("fenced"))
        await expect(exhausted.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("step_timeout"))
    })

    it("throws with the reason a claim did not run the step", async () => {
        const busy = await build([{ kind: "busy" }])
        const later = await build([{ kind: "later", retryAfterMs: 10 }])
        const closed = await build([{ kind: "closed" }])

        await expect(busy.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("step_busy"))
        await expect(later.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("retry_later"))
        await expect(closed.service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("step_closed"))
    })

    it("refuses a wake that has no run", async () => {
        const { service, store } = await build([])
        store.runOfWake.mockResolvedValue(null)

        await expect(service.runInline("wake-9", stepSpecOf(), SIGNAL)).rejects.toMatchObject({
            code: AgentRunsErrorCode.RunNotFound,
        })
    })
})

describe("AgentRunsService when the process is shutting down", () => {
    it("claims no new step and refuses an inline call, so the sweep or the next boot takes them", async () => {
        const { service, ledger } = await build([claimed("a")], [], undefined, true)

        await service.advance("run-1", SIGNAL)

        expect(ledger.claim).not.toHaveBeenCalled()
        await expect(service.runInline("wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(refusal("shutting_down"))
    })
})

describe("AgentRunsService.interrupted", () => {
    it("fails the step the runtime held so it retries, and leaves a wait alone", async () => {
        const held = stepViewOf({ stepKey: "turn" })
        const { service, steps, store } = await build([])
        store.stepsOf.mockResolvedValue([
            runStepViewOf({ stepKey: "ask", status: "running", waitItemId: "item-1" }),
            runStepViewOf({ stepKey: "turn", status: "running" }),
        ])
        store.viewsOf.mockResolvedValue([stepViewOf({ stepKey: "ask" }), held])

        await service.interrupted("wake-1", "runtime_down", SIGNAL)

        expect(steps.fail).toHaveBeenCalledWith(held, "runtime_down", true, SIGNAL)
    })

    it("does nothing for a wake with no run or no step in flight", async () => {
        const { service, steps, store } = await build([])
        store.stepsOf.mockResolvedValue([])
        await service.interrupted("wake-1", "runtime_down", SIGNAL)
        store.runOfWake.mockResolvedValue(null)
        await service.interrupted("wake-2", "runtime_down", SIGNAL)

        expect(steps.fail).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.resumeWaiting", () => {
    it("lets the wait step's handler turn the verdict into the result and the steps that follow, in the decision's transaction", async () => {
        const next = [stepSpecOf()]
        const handler: AgentStepHandler = {
            kind: "ask",
            run: () => Promise.resolve({ kind: "failed", code: "x" }),
            onDecided: (_step, decision) => ({ kind: "done", result: { approved: decision.approved }, next }),
        }
        const { service, store, em } = await build([], [], handler)

        await expect(service.resumeWaiting(em, "item-1", { approved: true, by: "member-1" })).resolves.toBe(true)

        expect(store.resume).toHaveBeenCalledWith(em, "item-1", { result: { approved: true }, next })
    })

    it("stores the verdict itself when the handler has no onDecided", async () => {
        const handler: AgentStepHandler = { kind: "ask", run: () => Promise.resolve({ kind: "failed", code: "x" }) }
        const { service, store, em } = await build([], [], handler)

        await service.resumeWaiting(em, "item-1", { approved: false, by: "timeout" })

        expect(store.resume).toHaveBeenCalledWith(em, "item-1", { result: { approved: false, by: "timeout" }, next: [] })
    })

    it("answers false and writes nothing when no step waits on the item, so a second approval is a no-op", async () => {
        const { service, store, em } = await build([])
        store.waitingOn.mockResolvedValue(null)

        await expect(service.resumeWaiting(em, "item-1", { approved: true, by: "member-1" })).resolves.toBe(false)
        expect(store.resume).not.toHaveBeenCalled()
    })
})
