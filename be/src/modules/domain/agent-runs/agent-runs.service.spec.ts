import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { OPEN, runStepViewOf, runViewOf, stepSpecOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import * as coverage from "@tests/fixtures/builders/agent-runs-coverage.builder"
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
    const store = mock<AgentRunStoreService>()
    coverage.arrangeRunStore(store)
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
            {
                provide: AgentRunHandlersService,
                useValue: mock<AgentRunHandlersService>({ of: jest.fn(() => handler) }),
            },
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

const WAIT = coverage.runWaitOf()

describe("AgentRunsService.waitsOn", () => {
    it("recognizes only a persisted wait in the caller's workspace", async () => {
        const { service, store } = await build([])
        await expect(service.waitsOn("ws-1", "item-1")).resolves.toBe(true)
        expect(store.waitingOn).toHaveBeenCalledWith("ws-1", "item-1")
        store.waitingOn.mockResolvedValue(null)
        await expect(service.waitsOn("ws-other", "item-1")).resolves.toBe(false)
        await expect(service.waitsOn("ws-1", "missing-item")).resolves.toBe(false)
    })
})

describe("AgentRunsService.waitOn", () => {
    it("appends, claims and commits the wait through the work item's manager", async () => {
        const { service, store, ledger, em } = await build([])
        store.waitingOn.mockResolvedValueOnce(null)
        const step = stepViewOf({ stepKey: WAIT.spec.stepKey })
        ledger.claimIn.mockResolvedValueOnce({ kind: "claimed", step })
        ledger.commitIn.mockResolvedValueOnce("ok")
        await service.waitOn(em, WAIT)
        expect(store.runOfWake).toHaveBeenCalledWith("ws-1", "wake-1", em)
        expect(store.appendRows).toHaveBeenCalledWith(em, { runId: "run-1", workspaceId: "ws-1" }, [WAIT.spec])
        expect(ledger.claimIn).toHaveBeenCalledWith(em, { runId: "run-1", workspaceId: "ws-1" }, WAIT.spec.stepKey)
        expect(ledger.commitIn).toHaveBeenCalledWith(em, step, {
            kind: "wait",
            workItemId: "item-1",
            deadlineAt: WAIT.deadlineAt,
        })
        expect(ledger.claim).not.toHaveBeenCalled()
    })

    it("reuses a wait already registered for the same item and step", async () => {
        const { service, store, ledger, em } = await build([])
        store.waitingOn.mockResolvedValueOnce(stepViewOf({ stepKey: WAIT.spec.stepKey }))
        await service.waitOn(em, WAIT)
        expect(store.appendRows).not.toHaveBeenCalled()
        expect(ledger.claimIn).not.toHaveBeenCalled()
    })

    it("reuses a completed step without making it wait again", async () => {
        const { service, store, ledger, em } = await build([])
        store.waitingOn.mockResolvedValueOnce(null)
        ledger.claimIn.mockResolvedValueOnce({ kind: "done", answer: {} })
        await service.waitOn(em, WAIT)
        expect(ledger.commitIn).not.toHaveBeenCalled()
    })

    it("refuses a work item already held by a different step", async () => {
        const { service, store, ledger, em } = await build([])
        await expect(service.waitOn(em, WAIT)).rejects.toMatchObject(refusal("wait_conflict"))
        expect(store.appendRows).not.toHaveBeenCalled()
        expect(ledger.claimIn).not.toHaveBeenCalled()
    })

    it("refuses a wake in another workspace or a missing run before writing or claiming its wait", async () => {
        const { service, store, ledger, em } = await build([])
        await expect(service.waitOn(em, { ...WAIT, workspaceId: "other-workspace" })).rejects.toMatchObject(
            refusal("wait_scope"),
        )
        store.runOfWake.mockResolvedValueOnce(null)
        await expect(service.waitOn(em, WAIT)).rejects.toMatchObject({ code: AgentRunsErrorCode.RunNotFound })
        expect(store.appendRows).not.toHaveBeenCalled()
        expect(ledger.claimIn).not.toHaveBeenCalled()
    })

    it("refuses an unclaimable or fenced step so the producer transaction rolls back", async () => {
        const busy = await build([])
        busy.store.waitingOn.mockResolvedValueOnce(null)
        busy.ledger.claimIn.mockResolvedValueOnce({ kind: "busy" })
        await expect(busy.service.waitOn(busy.em, WAIT)).rejects.toMatchObject(refusal("step_busy"))
        const fenced = await build([])
        fenced.store.waitingOn.mockResolvedValueOnce(null)
        fenced.ledger.claimIn.mockResolvedValueOnce(claimed(WAIT.spec.stepKey))
        fenced.ledger.commitIn.mockResolvedValueOnce("fenced")
        await expect(fenced.service.waitOn(fenced.em, WAIT)).rejects.toMatchObject(refusal("fenced"))
    })
})

describe("AgentRunsService.open and append", () => {
    it("opens the one run of a wake through the store", async () => {
        const { service, store, em } = await build([])
        await expect(service.open(em, OPEN)).resolves.toMatchObject({ id: "run-1" })
        expect(store.open).toHaveBeenCalledWith(em, OPEN)
    })

    it("answers the run the store holds for an id", async () => {
        const { service } = await build([])
        await expect(service.runOf("ws-1", "run-1")).resolves.toEqual(runViewOf())
    })

    it("writes steps behind the last one with the workspace of the run", async () => {
        const { service, store, em } = await build([])
        const specs = [stepSpecOf()]

        await service.append("ws-1", em, "run-1", specs)

        expect(store.append).toHaveBeenCalledWith(em, { runId: "run-1", workspaceId: "ws-1" }, specs)
    })

    it("writes nothing and reads nothing for no steps", async () => {
        const { service, store, em } = await build([])

        await service.append("ws-1", em, "run-1", [])

        expect(store.runIn).not.toHaveBeenCalled()
        expect(store.append).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.advance", () => {
    it("drives the pending steps in order until the run has none", async () => {
        const { service, steps, ledger } = await build([claimed("a"), claimed("b"), { kind: "idle" }], [DONE, DONE])

        await expect(service.advance("ws-1", "run-1", SIGNAL)).resolves.toEqual({
            run: runViewOf(),
            retryAfterMs: null,
        })

        expect(steps.execute).toHaveBeenCalledTimes(2)
        expect(ledger.claim).toHaveBeenCalledWith({ runId: "run-1", workspaceId: "ws-1" }, null)
    })

    it("parks a waiting branch and stops at a failed or fenced step", async () => {
        for (const end of [
            { kind: "wait", workItemId: "item-1" },
            { kind: "failed", code: "x" },
            { kind: "fenced" },
        ] satisfies ReadonlyArray<StepEnd>) {
            const waiting = end.kind === "wait"
            const { service, ledger } = await build([claimed("a"), waiting ? { kind: "idle" } : claimed("b")], [end])

            await service.advance("ws-1", "run-1", SIGNAL)

            expect(ledger.claim).toHaveBeenCalledTimes(waiting ? 2 : 1)
        }
    })

    it("continues a ready sibling after parking a wait and leaves the run waiting", async () => {
        const { service, ledger, steps, store } = await build(
            [claimed("ask"), claimed("door"), { kind: "idle" }],
            [{ kind: "wait", workItemId: "item-1" }, DONE],
        )
        store.runById.mockResolvedValueOnce(runViewOf({ status: "waiting" }))

        await expect(service.advance("ws-1", "run-1", SIGNAL)).resolves.toEqual({
            run: runViewOf({ status: "waiting" }),
            retryAfterMs: null,
        })

        expect(steps.execute.mock.calls.map(([step]) => step.stepKey)).toEqual(["ask", "door"])
        expect(ledger.claim).toHaveBeenCalledTimes(3)
    })
})

describe("AgentRunsService.advance scheduling", () => {
    it("answers how long a step is held by its backoff", async () => {
        const { service } = await build([{ kind: "later", retryAfterMs: 4000 }])

        await expect(service.advance("ws-1", "run-1", SIGNAL)).resolves.toMatchObject({ retryAfterMs: 4000 })
    })

    it("gives a step whose tries are spent to the failure route as a timeout", async () => {
        const step = stepViewOf({ attempt: 3 })
        const { service, steps } = await build(
            [{ kind: "exhausted", step }],
            [{ kind: "failed", code: "step_timeout" }],
        )

        await service.advance("ws-1", "run-1", SIGNAL)

        expect(steps.fail).toHaveBeenCalledWith(step, "step_timeout", false, SIGNAL)
    })

    it("continues an undo in progress when the run is closed to forward steps", async () => {
        const { service, compensation, steps } = await build([{ kind: "closed" }])

        await service.advance("ws-1", "run-1", SIGNAL)

        expect(compensation.run).toHaveBeenCalledWith({ runId: "run-1", workspaceId: "ws-1" }, SIGNAL)
        expect(steps.execute).not.toHaveBeenCalled()
    })

    it("leaves a busy, idle or gone run alone", async () => {
        for (const kind of ["busy", "idle", "gone"] as const) {
            const { service, steps, compensation } = await build([{ kind }])

            await service.advance("ws-1", "run-1", SIGNAL)

            expect(steps.execute).not.toHaveBeenCalled()
            expect(compensation.run).not.toHaveBeenCalled()
        }
    })

    it("hands the rest to a job after the bounded number of steps, and runs nothing once aborted", async () => {
        const many = Array.from({ length: 60 }, (_, index) => claimed(`s-${String(index)}`))
        const bounded = await build(
            many,
            Array.from({ length: 60 }, () => DONE),
        )
        await bounded.service.advance("ws-1", "run-1", SIGNAL)
        const stop = new AbortController()
        stop.abort()
        const aborted = await build([claimed("a")])
        await aborted.service.advance("ws-1", "run-1", stop.signal)

        expect(bounded.steps.execute).toHaveBeenCalledTimes(50)
        expect(aborted.ledger.claim).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.runInline replay", () => {
    it("answers a completed stage from its row without appending or claiming a closed run", async () => {
        const { service, store, ledger } = await build([])
        store.stepOf.mockResolvedValue(runStepViewOf({ status: "done", result: { stored: "original" } }))
        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({ stored: "original" })
        expect(store.append).not.toHaveBeenCalled()
        expect(ledger.claim).not.toHaveBeenCalled()
    })

    it("replays an empty completed answer without reopening its run", async () => {
        const { service, store } = await build([])
        store.stepOf.mockResolvedValue(runStepViewOf({ status: "done", result: null }))
        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({})
        expect(store.append).not.toHaveBeenCalled()
    })

    it("re-reads a completed answer when another driver closed the run before its claim", async () => {
        const { service, store, steps } = await build([{ kind: "closed" }])
        store.stepOf
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(runStepViewOf({ status: "done", result: { stored: "winner" } }))
        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({ stored: "winner" })
        expect(steps.execute).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.runInline", () => {
    it("adds the step to the run of the wake, runs it now and answers its result", async () => {
        const { service, steps, store, ledger } = await build([claimed("tool-1")], [DONE])
        const spec = stepSpecOf()

        await expect(service.runInline("ws-1", "wake-1", spec, SIGNAL)).resolves.toEqual({ ok: true })

        expect(store.append).toHaveBeenCalledWith(expect.anything(), { runId: "run-1", workspaceId: "ws-1" }, [spec])
        expect(ledger.claim).toHaveBeenCalledWith({ runId: "run-1", workspaceId: "ws-1" }, "tool-1")
        expect(steps.execute).toHaveBeenCalledTimes(1)
    })

    it("answers the stored result of a step done before, without calling the handler", async () => {
        const { service, steps } = await build([{ kind: "done", answer: { id: "order-1" } }])

        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({ id: "order-1" })
        expect(steps.execute).not.toHaveBeenCalled()
    })

    it("answers an empty result for a done step that stored none", async () => {
        const { service } = await build([{ kind: "done", answer: null }])

        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({})
    })

    it("answers that the step waits for a person", async () => {
        const { service } = await build([claimed("tool-1")], [{ kind: "wait", workItemId: "item-1" }])

        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).resolves.toEqual({
            waiting: true,
            workItemId: "item-1",
        })
    })

    it("throws with the code of a step that did not finish", async () => {
        const failed = await build([claimed("tool-1")], [{ kind: "failed", code: "connector_timeout" }])
        const fenced = await build([claimed("tool-1")], [{ kind: "fenced" }])
        const exhausted = await build(
            [{ kind: "exhausted", step: stepViewOf() }],
            [{ kind: "failed", code: "step_timeout" }],
        )

        await expect(failed.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("connector_timeout"),
        )
        await expect(fenced.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("fenced"),
        )
        await expect(exhausted.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("step_timeout"),
        )
    })

    it("throws with the reason a claim did not run the step", async () => {
        const busy = await build([{ kind: "busy" }])
        const later = await build([{ kind: "later", retryAfterMs: 10 }])
        const closed = await build([{ kind: "closed" }])

        await expect(busy.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("step_busy"),
        )
        await expect(later.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("retry_later"),
        )
        await expect(closed.service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("step_closed"),
        )
    })

    it("refuses a wake that has no run", async () => {
        const { service, store } = await build([])
        store.runOfWake.mockResolvedValue(null)

        await expect(service.runInline("ws-1", "wake-9", stepSpecOf(), SIGNAL)).rejects.toMatchObject({
            code: AgentRunsErrorCode.RunNotFound,
        })
    })
})

describe("AgentRunsService when the process is shutting down", () => {
    it("claims no new step and refuses an inline call, so the sweep or the next boot takes them", async () => {
        const { service, ledger } = await build([claimed("a")], [], undefined, true)

        await service.advance("ws-1", "run-1", SIGNAL)

        expect(ledger.claim).not.toHaveBeenCalled()
        await expect(service.runInline("ws-1", "wake-1", stepSpecOf(), SIGNAL)).rejects.toMatchObject(
            refusal("shutting_down"),
        )
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

        await service.interrupted("ws-1", "wake-1", "runtime_down", SIGNAL)

        expect(steps.fail).toHaveBeenCalledWith(held, "runtime_down", true, SIGNAL)
    })

    it("does nothing for a wake with no run or no step in flight", async () => {
        const { service, steps, store } = await build([])
        store.stepsOf.mockResolvedValue([])
        await service.interrupted("ws-1", "wake-1", "runtime_down", SIGNAL)
        store.runOfWake.mockResolvedValue(null)
        await service.interrupted("ws-1", "wake-2", "runtime_down", SIGNAL)

        expect(steps.fail).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.resumeWaiting", () => {
    it("refuses a handler that still needs review without completing the waiting work", async () => {
        const { service, store, em } = await build([], [], coverage.retryingDecisionHandlerOf())
        await expect(
            service.resumeWaiting("ws-1", em, "item-1", { approved: true, by: "member-1" }),
        ).rejects.toMatchObject(refusal("decision_not_ready"))
        expect(store.resume).not.toHaveBeenCalled()
    })

    it("refuses an approved legacy decision with no recorded principal", async () => {
        const { service, store, em } = await build([])
        await expect(service.resumeWaiting("ws-1", em, "item-1", { approved: true, by: null })).rejects.toMatchObject(
            refusal("decision_actor_unknown"),
        )
        expect(store.resume).not.toHaveBeenCalled()
    })

    it("lets the wait step's handler turn the verdict into the result and the steps that follow, in the decision's transaction", async () => {
        const next = [stepSpecOf()]
        const handler: AgentStepHandler = {
            kind: "ask",
            run: () => Promise.resolve({ kind: "failed", code: "x" }),
            onDecided: (_step, decision) => ({ kind: "done", result: { approved: decision.approved }, next }),
        }
        const { service, store, em } = await build([], [], handler)

        await expect(service.resumeWaiting("ws-1", em, "item-1", { approved: true, by: "member-1" })).resolves.toBe(
            true,
        )

        expect(store.resume).toHaveBeenCalledWith(em, "ws-1", "item-1", { result: { approved: true }, next })
    })

    it("stores the verdict itself when the handler has no onDecided", async () => {
        const handler: AgentStepHandler = { kind: "ask", run: () => Promise.resolve({ kind: "failed", code: "x" }) }
        const { service, store, em } = await build([], [], handler)

        await service.resumeWaiting("ws-1", em, "item-1", { approved: false, by: "timeout" })

        expect(store.resume).toHaveBeenCalledWith(em, "ws-1", "item-1", {
            result: { approved: false, by: "timeout" },
            next: [],
        })
    })

    it("refuses an invalid decision payload rather than silently completing the wait as approved", async () => {
        const handler: AgentStepHandler = {
            kind: "ask",
            run: () => Promise.resolve({ kind: "failed", code: "invalid_input" }),
            onDecided: () => ({ kind: "failed", code: "invalid_input" }),
        }
        const { service, store, em } = await build([], [], handler)
        await expect(
            service.resumeWaiting("ws-1", em, "item-1", { approved: true, by: "member-1" }),
        ).rejects.toMatchObject(refusal("invalid_input"))
        expect(store.resume).not.toHaveBeenCalled()
    })

    it("answers false and writes nothing when no step waits on the item, so a second approval is a no-op", async () => {
        const { service, store, em } = await build([])
        store.waitingOn.mockResolvedValue(null)

        await expect(service.resumeWaiting("ws-1", em, "item-1", { approved: true, by: "member-1" })).resolves.toBe(
            false,
        )
        expect(store.resume).not.toHaveBeenCalled()
    })
})

describe("AgentRunsService.linksFor", () => {
    it("reads exact scoped lifecycle links after the approval wait finished", async () => {
        const { service, store } = await build([])
        const links = coverage.terminalLinksOf()
        store.linksFor.mockResolvedValue(links)
        await expect(service.linksFor("ws-1", "approval", "workItemId", "item-1")).resolves.toEqual(links)
        expect(store.linksFor.mock.calls).toEqual([["ws-1", "approval", "workItemId", "item-1"]])
    })
})
