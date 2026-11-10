import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { stepSpecOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { TOOL_OUTCOME_UNKNOWN } from "./policies/agent-runs.policy"
import type { RouteStep } from "./policies/failure-route.policy"
import type { AgentStepHandler, StepAnswer } from "./agent-runs.contracts"
import type { CommitResult } from "./agent-runs-engine.contracts"

const SIGNAL = new AbortController().signal

const doneDoor: RouteStep = {
    stepKey: "door",
    seq: 1,
    status: "done",
    effect: { kind: "compensable", compensation: "close_item" },
}

const donePivot: RouteStep = { stepKey: "out", seq: 1, status: "done", effect: { kind: "pivot" } }

const build = async (
    answer: StepAnswer | Error | "none",
    over: { readonly steps?: ReadonlyArray<RouteStep>; readonly commits?: ReadonlyArray<CommitResult> } = {},
) => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const logger = mock<Logger>()
    const handler = mock<AgentStepHandler>({
        kind: "turn",
        run: answer instanceof Error ? jest.fn().mockRejectedValue(answer) : jest.fn().mockResolvedValue(answer),
    })
    const ledger = mock<AgentStepLedgerService>()
    ;(over.commits ?? ["ok"]).forEach((commit) => {
        ledger.commit.mockResolvedValueOnce(commit)
        ledger.commitIn.mockResolvedValueOnce(commit)
    })
    const store = mock<AgentRunStoreService>({
        routeStepsOf: jest.fn().mockResolvedValue(over.steps ?? []),
        route: jest.fn().mockResolvedValue(true),
    })
    const compensation = mock<AgentRunCompensationService>({ run: jest.fn().mockResolvedValue(undefined) })
    const deadLetter = mock<AgentRunDeadLetterService>({ tell: jest.fn().mockResolvedValue(undefined) })
    const resume = mock<AgentRunResumeService>({ markParked: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunStepsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
            {
                provide: AgentRunHandlersService,
                useValue: mock<AgentRunHandlersService>({
                    of: jest.fn(() => (answer === "none" ? undefined : handler)),
                }),
            },
            { provide: AgentStepLedgerService, useValue: ledger },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunCompensationService, useValue: compensation },
            { provide: AgentRunDeadLetterService, useValue: deadLetter },
            { provide: AgentRunResumeService, useValue: resume },
        ],
    }).compile()
    return {
        service: container.get(AgentRunStepsService),
        handler,
        ledger,
        store,
        compensation,
        deadLetter,
        resume,
        logger,
        tx,
    }
}

describe("AgentRunStepsService.execute", () => {
    it("stores a done answer with the steps that follow and answers its result", async () => {
        const next = [stepSpecOf({ stepKey: "after" })]
        const { service, ledger } = await build({ kind: "done", result: { reply: "hi" }, next })

        await expect(service.execute(stepViewOf(), SIGNAL)).resolves.toEqual({ kind: "done", result: { reply: "hi" } })

        expect(ledger.commit).toHaveBeenCalledWith(expect.anything(), { kind: "done", result: { reply: "hi" }, next })
    })

    it("stores a wait with the work item and its deadline", async () => {
        const deadlineAt = new Date("2026-11-02T00:00:00Z")
        const { service, ledger } = await build({ kind: "wait", workItemId: "item-1", deadlineAt })

        await expect(service.execute(stepViewOf(), SIGNAL)).resolves.toEqual({ kind: "wait", workItemId: "item-1" })

        expect(ledger.commit).toHaveBeenCalledWith(expect.anything(), {
            kind: "wait",
            workItemId: "item-1",
            deadlineAt,
        })
    })

    it("preserves the inline owner's continuation when no next step has been appended yet", async () => {
        const { service, ledger } = await build({ kind: "done", result: {}, next: [], continues: true })
        await expect(service.execute(stepViewOf(), SIGNAL)).resolves.toEqual({ kind: "done", result: {} })
        expect(ledger.commit).toHaveBeenCalledWith(expect.anything(), {
            kind: "done",
            result: {},
            next: [],
            continues: true,
        })
    })

    it("answers fenced and goes no further when the claim moved on before the commit", async () => {
        const { service, logger } = await build({ kind: "done", result: {}, next: [] }, { commits: ["fenced"] })

        await expect(service.execute(stepViewOf(), SIGNAL)).resolves.toEqual({ kind: "fenced" })

        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.StepFenced, expect.anything())
    })

    it("fails a step whose kind nobody handles", async () => {
        const { service, ledger, logger, deadLetter } = await build("none")

        await expect(service.execute(stepViewOf(), SIGNAL)).resolves.toEqual({ kind: "failed", code: "no_handler" })

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.NoHandler, expect.any(Error), expect.anything())
        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "failed",
            code: "no_handler",
        })
        expect(deadLetter.tell).toHaveBeenCalledWith("ws-1", "run-1", "turn", "no_handler", {})
    })
})

describe("AgentRunStepsService.execute failures", () => {
    it("tries a handler that throws a transient failure again after a backoff", async () => {
        const { service, ledger, logger } = await build(Object.assign(new Error("reset"), { code: "ECONNRESET" }))

        await expect(service.execute(stepViewOf({ attempt: 1 }), SIGNAL)).resolves.toEqual({
            kind: "failed",
            code: "handler_threw",
        })

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.HandlerThrew, expect.any(Error), expect.anything())
        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "retry",
            code: "handler_threw",
            afterMs: 2000,
        })
    })

    it("parks at once a handler that throws what no try can cure, and records the build", async () => {
        const { service, ledger, store, deadLetter, resume } = await build(new Error("bug"), { steps: [doneDoor] })

        await service.execute(stepViewOf({ attempt: 1 }), SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "failed",
            code: "handler_threw",
        })
        expect(store.route).toHaveBeenCalledWith(
            "ws-1",
            "run-1",
            {
                from: "running",
                to: "parked",
                code: "handler_threw",
                compensate: [],
            },
            expect.anything(),
        )
        expect(resume.markParked).toHaveBeenCalledWith("ws-1", "run-1")
        expect(deadLetter.tell).toHaveBeenCalledWith("ws-1", "run-1", "turn", "handler_threw", {})
    })

    it("parks a step the handler answered failed instead of undoing the steps done before it", async () => {
        const { service, compensation, store } = await build(
            { kind: "failed", code: "invalid_step_input" },
            { steps: [doneDoor] },
        )

        await service.execute(stepViewOf(), SIGNAL)

        expect(store.route).toHaveBeenCalledWith(
            "ws-1",
            "run-1",
            expect.objectContaining({ to: "parked" }),
            expect.anything(),
        )
        expect(compensation.run).not.toHaveBeenCalled()
    })

    it("keeps the code of a domain error a handler throws", async () => {
        class Coded extends DomainError<string> {}
        const { service, ledger } = await build(new Coded({ code: "SLOW_TIMEOUT" }))

        await service.execute(stepViewOf(), SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ code: "SLOW_TIMEOUT" }),
        )
    })
})

describe("AgentRunStepsService the cause of a failure", () => {
    class Coded extends DomainError<string> {}
    const PARAMS = { problem: "QUERY_NOT_INDEXED", at: "order", entity: "chat.message" }

    it("logs the code and the secret-free params of a domain error a handler throws, with the failed step and the park", async () => {
        const { service, logger, deadLetter } = await build(
            new Coded({ code: "ENTITY_ENGINE_QUERY_INVALID", params: PARAMS }),
            {
                steps: [doneDoor],
            },
        )

        await service.execute(stepViewOf(), SIGNAL)

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.HandlerThrew, expect.any(Error), {
            runId: "run-1",
            stepKey: "turn",
            code: "ENTITY_ENGINE_QUERY_INVALID",
            params: PARAMS,
        })
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.StepFailed, {
            runId: "run-1",
            stepKey: "turn",
            code: "ENTITY_ENGINE_QUERY_INVALID",
            params: PARAMS,
        })
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.RunParked, {
            runId: "run-1",
            stepKey: "turn",
            code: "ENTITY_ENGINE_QUERY_INVALID",
            params: PARAMS,
        })
        expect(deadLetter.tell).toHaveBeenCalledWith("ws-1", "run-1", "turn", "ENTITY_ENGINE_QUERY_INVALID", PARAMS)
    })

    it("logs no params for an error that carries none, and the params of a retry", async () => {
        const { service, logger } = await build(Object.assign(new Error("reset"), { code: "ECONNRESET" }))

        await service.execute(stepViewOf({ attempt: 1 }), SIGNAL)

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.HandlerThrew, expect.any(Error), {
            runId: "run-1",
            stepKey: "turn",
            code: "handler_threw",
            params: {},
        })
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.StepRetry, {
            runId: "run-1",
            stepKey: "turn",
            code: "handler_threw",
            params: {},
        })
    })
})

describe("AgentRunStepsService.fail", () => {
    it("backs off and tries again while the step has tries, in one transaction with the record", async () => {
        const { service, ledger, store, tx, deadLetter, compensation } = await build({ kind: "retry", code: "slow" })

        await expect(service.fail(stepViewOf({ attempt: 2 }), "slow", true, SIGNAL)).resolves.toEqual({
            kind: "failed",
            code: "slow",
        })

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "retry",
            code: "slow",
            afterMs: 4000,
        })
        expect(store.route).not.toHaveBeenCalled()
        expect(deadLetter.tell).not.toHaveBeenCalled()
        expect(compensation.run).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("gives a step that names no budget the default tries", async () => {
        const { service, ledger } = await build({ kind: "retry", code: "slow" })

        await service.fail(stepViewOf({ attempt: 3, maxAttempts: undefined }), "slow", true, SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "failed",
            code: "slow",
        })
    })
})

describe("AgentRunStepsService.fail undoing and parking", () => {
    it("undoes the done compensable steps in reverse order when no pivot is done and the tries are spent", async () => {
        const { service, store, compensation, deadLetter } = await build(
            { kind: "retry", code: "slow" },
            { steps: [doneDoor] },
        )

        await service.fail(stepViewOf({ attempt: 3 }), "slow", true, SIGNAL)

        expect(store.route).toHaveBeenCalledWith(
            "ws-1",
            "run-1",
            {
                from: "running",
                to: "compensating",
                code: "slow",
                compensate: ["door"],
            },
            expect.anything(),
        )
        expect(compensation.run).toHaveBeenCalledWith(
            expect.objectContaining({ runId: "run-1", workspaceId: "ws-1" }),
            SIGNAL,
        )
        expect(deadLetter.tell).not.toHaveBeenCalled()
    })

    it("goes forward to a person and undoes nothing once a pivot is done", async () => {
        const { service, store, compensation, deadLetter } = await build(
            { kind: "failed", code: "bad" },
            { steps: [doneDoor, donePivot] },
        )

        await service.fail(stepViewOf(), "bad", false, SIGNAL)

        expect(store.route).toHaveBeenCalledWith(
            "ws-1",
            "run-1",
            {
                from: "running",
                to: "parked",
                code: "bad",
                compensate: [],
            },
            expect.anything(),
        )
        expect(compensation.run).not.toHaveBeenCalled()
        expect(deadLetter.tell).toHaveBeenCalledWith("ws-1", "run-1", "turn", "bad", {})
    })

    it("sends an unknown tool outcome to a person at once and never retries it", async () => {
        const { service, ledger, deadLetter } = await build({ kind: "failed", code: TOOL_OUTCOME_UNKNOWN })

        await service.fail(stepViewOf({ attempt: 1 }), TOOL_OUTCOME_UNKNOWN, true, SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "failed",
            code: TOOL_OUTCOME_UNKNOWN,
        })
        expect(deadLetter.tell).toHaveBeenCalledWith("ws-1", "run-1", "turn", TOOL_OUTCOME_UNKNOWN, {})
    })
})

describe("AgentRunStepsService.fail when the claim moved on", () => {
    it("changes nothing when the fence moved on: no route, no undo, nobody told", async () => {
        const { service, store, compensation, deadLetter } = await build(
            { kind: "failed", code: "bad" },
            { commits: ["fenced"] },
        )

        await expect(service.fail(stepViewOf(), "bad", false, SIGNAL)).resolves.toEqual({ kind: "fenced" })
        const retrying = await build({ kind: "retry", code: "x" }, { commits: ["fenced"] })
        await expect(retrying.service.fail(stepViewOf(), "x", true, SIGNAL)).resolves.toEqual({ kind: "fenced" })

        expect(store.route).not.toHaveBeenCalled()
        expect(compensation.run).not.toHaveBeenCalled()
        expect(deadLetter.tell).not.toHaveBeenCalled()
    })
})

describe("AgentRunStepsService side steps", () => {
    const pass = {
        result: { output: null, failed: "handler_threw", passedOver: true },
        next: [stepSpecOf({ stepKey: "after" })],
    }

    it("records a side step that failed past its tries with its failure, writes the steps that follow and tells a person", async () => {
        const { service, handler, ledger, store, deadLetter, logger } = await build(new Error("relation check"))
        handler.passOver = jest.fn().mockResolvedValue(pass)
        handler.sideFailed = jest.fn().mockResolvedValue(undefined)

        await expect(service.execute(stepViewOf({ attempt: 1 }), SIGNAL)).resolves.toEqual({
            kind: "done",
            result: pass.result,
        })

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), { kind: "done", ...pass })
        expect(store.route).not.toHaveBeenCalled()
        expect(deadLetter.tell).not.toHaveBeenCalled()
        expect(handler.sideFailed).toHaveBeenCalledWith(expect.objectContaining({ stepKey: "turn" }), "handler_threw")
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.StepPassedOver, expect.anything())
    })

    it("tries a side step again while it has tries, without asking to go past it", async () => {
        const { service, handler, ledger } = await build(Object.assign(new Error("reset"), { code: "ECONNRESET" }))

        await service.execute(stepViewOf({ attempt: 1 }), SIGNAL)

        expect(handler.passOver).not.toHaveBeenCalled()
        expect(ledger.commitIn).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ kind: "retry" }),
        )
    })

    it("stops the run as any other when the handler cannot say how to go past the step", async () => {
        const { service, handler, store, logger } = await build(new Error("boom"))
        handler.passOver = jest.fn().mockRejectedValue(new Error("graph gone"))

        await expect(service.execute(stepViewOf({ attempt: 1 }), SIGNAL)).resolves.toEqual({
            kind: "failed",
            code: "handler_threw",
        })

        expect(logger.error).toHaveBeenCalledWith(
            AgentRunsLogEvent.PassOverFailed,
            expect.any(Error),
            expect.anything(),
        )
        expect(store.route).toHaveBeenCalledWith(
            "ws-1",
            "run-1",
            expect.objectContaining({ to: "parked" }),
            expect.anything(),
        )
    })

    it("goes on even when telling the person fails", async () => {
        const { service, handler, logger } = await build(new Error("boom"))
        handler.passOver = jest.fn().mockResolvedValue(pass)
        handler.sideFailed = jest.fn().mockRejectedValue(new Error("no items"))

        await expect(service.execute(stepViewOf({ attempt: 1 }), SIGNAL)).resolves.toMatchObject({ kind: "done" })
        expect(logger.error).toHaveBeenCalledWith(
            AgentRunsLogEvent.SideTellFailed,
            expect.any(Error),
            expect.anything(),
        )
    })
})

describe("AgentRunStepsService.execute, the claim of a long step", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    /** A handler that answers only when released, like a step whose model call and its retry are still in flight. */
    const slow = async (commits: ReadonlyArray<CommitResult> = ["ok"]) => {
        const fixture = await build({ kind: "done", result: { ok: true }, next: [] }, { commits })
        let release: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const seen: { signal?: AbortSignal } = {}
        fixture.handler.run.mockImplementation(async (_step, signal) => {
            seen.signal = signal
            await gate
            return { kind: "done", result: { ok: true }, next: [] }
        })
        return { ...fixture, release, seen }
    }

    it("is never re-claimed while it holds a 180 s model budget: the claim is renewed three times per deadline and the commit goes under the renewed fence", async () => {
        const { service, ledger, release, logger } = await slow()
        const claimed = stepViewOf({ deadlineMs: 120_000, fence: 7 })
        let fence = 7
        ledger.renew.mockImplementation(() => Promise.resolve((fence += 1)))

        const done = service.execute(claimed, new AbortController().signal)
        // A model call that times out at 90 s and its one retry: 180 s of work under a 120 s deadline.
        await jest.advanceTimersByTimeAsync(180_000)

        // Renewed every 40 s, so the claim never came within a beat of lapsing: no sweep or job could take the step.
        expect(ledger.renew).toHaveBeenCalledTimes(4)
        expect(ledger.renew.mock.calls.map(([view]) => view.fence)).toEqual([7, 8, 9, 10])
        release()
        await expect(done).resolves.toEqual({ kind: "done", result: { ok: true } })
        expect(ledger.commit.mock.calls[0]?.[0]).toMatchObject({ fence: 11, attempt: claimed.attempt })
        expect(logger.warn).not.toHaveBeenCalledWith(AgentRunsLogEvent.StepFenced, expect.anything())

        await jest.advanceTimersByTimeAsync(300_000)
        expect(ledger.renew).toHaveBeenCalledTimes(4)
    })

    it("stops a try whose claim another try took: its handler's signal is aborted and it commits and reports nothing", async () => {
        const { service, ledger, release, seen, deadLetter, logger } = await slow()
        ledger.renew.mockResolvedValue(null)

        const done = service.execute(stepViewOf({ deadlineMs: 120_000 }), new AbortController().signal)
        await jest.advanceTimersByTimeAsync(40_000)

        expect(seen.signal?.aborted).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.StepClaimLost, expect.anything())
        release()
        await expect(done).resolves.toEqual({ kind: "fenced" })
        expect(ledger.commit).not.toHaveBeenCalled()
        expect(ledger.commitIn).not.toHaveBeenCalled()
        expect(deadLetter.tell).not.toHaveBeenCalled()
    })

    it("keeps the claim when a renewal fails once: the next beat renews it", async () => {
        const { service, ledger, release, logger } = await slow()
        ledger.renew.mockRejectedValueOnce(new Error("db down")).mockResolvedValue(9)

        const done = service.execute(stepViewOf({ deadlineMs: 120_000, fence: 7 }), new AbortController().signal)
        await jest.advanceTimersByTimeAsync(80_000)
        release()

        await expect(done).resolves.toMatchObject({ kind: "done" })
        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.StepRenewFailed, expect.any(Error), expect.anything())
        expect(ledger.commit.mock.calls[0]?.[0]).toMatchObject({ fence: 9 })
    })
})

