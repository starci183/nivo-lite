import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { runStepViewOf, runViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunSweepService } from "./agent-run-sweep.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { AGENT_RUN_ITEM_VERDICTS, AGENT_RUN_WAIT_TIMEOUT } from "./agent-runs.decorators"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import type { AgentRunItemVerdicts, AgentRunWaitTimeout, RunDue, RunStepView, WaitExpiry } from "./agent-runs-engine.contracts"
import type { StepDecision } from "./agent-runs.contracts"

const due = (over: Partial<RunDue> = {}): RunDue => ({
    kind: "expired",
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    stepKey: "door",
    fence: 3,
    at: new Date("2026-11-01T10:00:00Z"),
    ...over,
})

const waiting = (over: Partial<RunStepView> = {}): RunStepView =>
    runStepViewOf({ stepKey: "door", status: "running", fence: 3, waitItemId: "item-1", ...over })

/** The graph's timeout when one is wired, and the token of an optional injection nothing bound. */
const bound = mock<AgentRunWaitTimeout>()
const verdictPort = mock<AgentRunItemVerdicts>()

interface Options {
    readonly items: ReadonlyArray<RunDue>
    readonly step?: RunStepView | null
    readonly fresh?: RunStepView | null
    readonly expiry?: WaitExpiry | null
    readonly decides?: boolean
    readonly verdicts?: ReadonlyMap<string, StepDecision>
}

const build = async (options: Options) => {
    const logger = mock<Logger>()
    const em = mockEntityManager()
    fakeTransaction(em)
    const handlers = mock<AgentRunHandlersService>({
        of: jest.fn(() => ({
            kind: "ask",
            run: () => Promise.resolve({ kind: "failed" as const, code: "x" }),
            ...(options.decides === true ? { onDecided: () => ({ kind: "done" as const, result: {}, next: [] }) } : {}),
        })),
    })
    const store = mock<AgentRunStoreService>({
        due: jest.fn().mockResolvedValue(options.items),
        stepOf: jest
            .fn()
            .mockResolvedValueOnce(options.step ?? null)
            .mockResolvedValue(options.fresh === undefined ? (options.step ?? null) : options.fresh),
        viewsOf: jest.fn().mockResolvedValue([stepViewOf({ stepKey: "door", fence: 3 })]),
        runById: jest.fn().mockResolvedValue(runViewOf({ status: "dead", errorCode: "boom" })),
    })
    const runs = mock<AgentRunsService>({
        advance: jest.fn().mockResolvedValue({ run: null, retryAfterMs: null }),
        resumeWaiting: jest.fn().mockResolvedValue(true),
    })
    const steps = mock<AgentRunStepsService>({ fail: jest.fn().mockResolvedValue({ kind: "failed", code: "wait_timeout" }) })
    const ledger = mock<AgentStepLedgerService>({ commit: jest.fn().mockResolvedValue("ok") })
    const compensation = mock<AgentRunCompensationService>({ run: jest.fn().mockResolvedValue(undefined) })
    const deadLetter = mock<AgentRunDeadLetterService>({ tell: jest.fn().mockResolvedValue(undefined) })
    verdictPort.verdictsOf.mockReset()
    verdictPort.verdictsOf.mockResolvedValue(options.verdicts ?? new Map())
    store.openWaits.mockResolvedValue(options.verdicts === undefined ? [] : [waiting()])
    bound.expire.mockReset()
    bound.expire.mockResolvedValue(options.expiry ?? { kind: "ended" })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunSweepService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: LOGGER, useValue: logger },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunStepsService, useValue: steps },
            { provide: AgentStepLedgerService, useValue: ledger },
            { provide: AgentRunCompensationService, useValue: compensation },
            { provide: AgentRunDeadLetterService, useValue: deadLetter },
            { provide: AGENT_RUN_ITEM_VERDICTS, useValue: verdictPort },
            { provide: AGENT_RUN_WAIT_TIMEOUT, useValue: bound },
        ],
    }).compile()
    const service = container.get(AgentRunSweepService)
    return { service, store, runs, steps, ledger, compensation, deadLetter, timeouts: bound, logger }
}

describe("AgentRunSweepService.sweep", () => {
    it("resumes a step whose claim ran out by driving the run, the way a job does", async () => {
        const { service, runs } = await build({ items: [due()], step: waiting({ waitItemId: null }) })

        await expect(service.sweep()).resolves.toEqual({ expired: 1, ready: 0, compensating: 0, unspoken: 0, recovered: 0 })

        expect(runs.advance).toHaveBeenCalledWith("run-1", expect.any(AbortSignal))
    })

    it("leaves a step that finished or moved on since it was found", async () => {
        const gone = await build({ items: [due()], step: null })
        const done = await build({ items: [due()], step: waiting({ status: "done" }) })
        const fenced = await build({ items: [due()], step: waiting({ fence: 9, waitItemId: null }) })

        await expect(gone.service.sweep()).resolves.toMatchObject({ expired: 0 })
        await expect(done.service.sweep()).resolves.toMatchObject({ expired: 0 })
        await expect(fenced.service.sweep()).resolves.toMatchObject({ expired: 0 })
        expect(gone.runs.advance).not.toHaveBeenCalled()
        expect(done.runs.advance).not.toHaveBeenCalled()
        expect(fenced.runs.advance).not.toHaveBeenCalled()
    })

    it("drives a ready step no job picked up, continues an undo and tells a stopped run", async () => {
        const { service, runs, compensation, deadLetter } = await build({
            items: [due({ kind: "ready" }), due({ kind: "compensating" }), due({ kind: "unspoken", stepKey: "" })],
        })

        await expect(service.sweep()).resolves.toEqual({ expired: 0, ready: 1, compensating: 1, unspoken: 1, recovered: 0 })

        expect(runs.advance).toHaveBeenCalledTimes(1)
        expect(compensation.run).toHaveBeenCalledWith("run-1", expect.any(AbortSignal))
        expect(deadLetter.tell).toHaveBeenCalledWith("run-1", null, "boom")
    })

    it("names an unknown reason when the stopped run kept none", async () => {
        const { service, store, deadLetter } = await build({ items: [due({ kind: "unspoken" })] })
        store.runById.mockResolvedValue(null)

        await service.sweep()

        expect(deadLetter.tell).toHaveBeenCalledWith("run-1", null, "unknown")
    })

})

describe("AgentRunSweepService.sweep waits and failures", () => {
    it("hands a wait past its deadline to the graph's timeout and stops it visibly when nobody answered", async () => {
        const { service, timeouts, steps } = await build({ items: [due()], step: waiting(), expiry: { kind: "ended" } })

        await service.sweep()

        expect(timeouts?.expire).toHaveBeenCalledWith("item-1")
        expect(steps.fail).toHaveBeenCalledWith(expect.objectContaining({ stepKey: "door" }), "wait_timeout", false, expect.any(AbortSignal))
    })

})

describe("AgentRunSweepService.sweep recovers waits from their items", () => {
    it("finishes a wait whose item already closed approved with that decision, and never asks the clock, inside one sweep", async () => {
        const { service, runs, timeouts, steps } = await build({
            items: [due()],
            step: waiting({ status: "done", waitItemId: null }),
            verdicts: new Map([["item-1", { approved: true, by: "recovered" }]]),
            expiry: { kind: "ended" },
        })

        await expect(service.sweep()).resolves.toMatchObject({ recovered: 1 })

        expect(runs.resumeWaiting).toHaveBeenCalledWith(expect.anything(), "item-1", { approved: true, by: "recovered" })
        expect(timeouts?.expire).not.toHaveBeenCalled()
        expect(steps.fail).not.toHaveBeenCalled()
    })

    it("counts no recovery when the item has no verdict yet, or the step was finished already", async () => {
        const open = await build({ items: [], verdicts: new Map() })
        open.store.openWaits.mockResolvedValue([waiting({ waitItemId: null })])
        await expect(open.service.sweep()).resolves.toMatchObject({ recovered: 0 })

        const finished = await build({ items: [], verdicts: new Map([["item-1", { approved: false, by: "recovered" }]]) })
        finished.runs.resumeWaiting.mockResolvedValue(false)
        await expect(finished.service.sweep()).resolves.toMatchObject({ recovered: 0 })
    })

    it("logs a recovery that failed and goes on", async () => {
        const { service, runs, logger } = await build({
            items: [],
            verdicts: new Map([["item-1", { approved: true, by: "recovered" }]]),
        })
        runs.resumeWaiting.mockRejectedValueOnce(new Error("db down"))

        await expect(service.sweep()).resolves.toMatchObject({ recovered: 0 })

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.SweepItemFailed, expect.any(Error), expect.anything())
    })

})

describe("AgentRunSweepService.sweep waits and failures", () => {
    it("hands a wait that ran out to the step's handler as a refusal by the clock when it can decide", async () => {
        const { service, runs, steps } = await build({ items: [due()], step: waiting(), expiry: { kind: "ended" }, decides: true })

        await service.sweep()

        expect(runs.resumeWaiting).toHaveBeenCalledWith(expect.anything(), "item-1", { approved: false, by: "timeout" })
        expect(steps.fail).not.toHaveBeenCalled()
    })

    it("keeps waiting under the new deadline when the graph asked a backup group", async () => {
        const deadlineAt = new Date("2026-11-02T10:00:00Z")
        const { service, ledger, steps } = await build({ items: [due()], step: waiting(), expiry: { kind: "renewed", deadlineAt } })

        await service.sweep()

        expect(ledger.commit).toHaveBeenCalledWith(expect.objectContaining({ stepKey: "door" }), {
            kind: "wait",
            workItemId: "item-1",
            deadlineAt,
        })
        expect(steps.fail).not.toHaveBeenCalled()
    })

    it("leaves a wait the person answered while the graph's timeout ran", async () => {
        const { service, steps, ledger } = await build({
            items: [due()],
            step: waiting(),
            fresh: waiting({ status: "done", waitItemId: null }),
            expiry: { kind: "ended" },
        })

        await service.sweep()
        const missing = await build({ items: [due()], step: waiting(), fresh: null, expiry: { kind: "ended" } })
        await missing.service.sweep()

        expect(steps.fail).not.toHaveBeenCalled()
        expect(ledger.commit).not.toHaveBeenCalled()
        expect(missing.steps.fail).not.toHaveBeenCalled()
    })

    it("goes on with the rest when one item fails, and logs it", async () => {
        const { service, runs, logger } = await build({ items: [due({ kind: "ready" }), due({ kind: "ready", runId: "run-2" })] })
        runs.advance.mockRejectedValueOnce(new Error("db down"))

        await expect(service.sweep()).resolves.toMatchObject({ ready: 1 })

        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.SweepItemFailed, expect.any(Error), expect.anything())
    })
})
