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
        ],
    }).compile()
    return { service: container.get(AgentRunStepsService), ledger, store, compensation, deadLetter, logger, tx }
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
        expect(deadLetter.tell).toHaveBeenCalledWith("run-1", "turn", "no_handler")
    })
})

describe("AgentRunStepsService.execute failures", () => {
    it("treats a handler that throws as a try that failed and may be tried again", async () => {
        const { service, ledger, logger } = await build(new Error("boom"))

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

    it("keeps the code of a domain error a handler throws", async () => {
        class Coded extends DomainError<string> {}
        const { service, ledger } = await build(new Coded({ code: "SLOW_CONNECTOR" }))

        await service.execute(stepViewOf(), SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ code: "SLOW_CONNECTOR" }),
        )
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

    it("undoes the done compensable steps in reverse order when no pivot is done and the tries are spent", async () => {
        const { service, store, compensation, deadLetter } = await build(
            { kind: "retry", code: "slow" },
            { steps: [doneDoor] },
        )

        await service.fail(stepViewOf({ attempt: 3 }), "slow", true, SIGNAL)

        expect(store.route).toHaveBeenCalledWith(expect.anything(), "run-1", {
            from: "running",
            to: "compensating",
            code: "slow",
            compensate: ["door"],
        })
        expect(compensation.run).toHaveBeenCalledWith("run-1", SIGNAL)
        expect(deadLetter.tell).not.toHaveBeenCalled()
    })

    it("goes forward to a person and undoes nothing once a pivot is done", async () => {
        const { service, store, compensation, deadLetter } = await build(
            { kind: "failed", code: "bad" },
            { steps: [doneDoor, donePivot] },
        )

        await service.fail(stepViewOf(), "bad", false, SIGNAL)

        expect(store.route).toHaveBeenCalledWith(expect.anything(), "run-1", {
            from: "running",
            to: "dead",
            code: "bad",
            compensate: [],
        })
        expect(compensation.run).not.toHaveBeenCalled()
        expect(deadLetter.tell).toHaveBeenCalledWith("run-1", "turn", "bad")
    })

    it("sends an unknown tool outcome to a person at once and never retries it", async () => {
        const { service, ledger, deadLetter } = await build({ kind: "failed", code: TOOL_OUTCOME_UNKNOWN })

        await service.fail(stepViewOf({ attempt: 1 }), TOOL_OUTCOME_UNKNOWN, true, SIGNAL)

        expect(ledger.commitIn).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            kind: "failed",
            code: TOOL_OUTCOME_UNKNOWN,
        })
        expect(deadLetter.tell).toHaveBeenCalledWith("run-1", "turn", TOOL_OUTCOME_UNKNOWN)
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
