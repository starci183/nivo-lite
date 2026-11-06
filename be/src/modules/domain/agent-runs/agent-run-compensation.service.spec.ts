import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import type { AgentStepHandler, StepView } from "./agent-runs.contracts"
import type { CompensationClaim, CompensationCommit, RunView } from "./agent-runs-engine.contracts"

/** What the scene recorded: the steps undone, and the people told with the code they were told. */
interface Tally {
    readonly undone: Array<string>
    readonly told: Array<string>
}

const door = (name: string): StepView =>
    stepViewOf({ stepKey: `door-${name}`, kind: "door", effect: { kind: "compensable", compensation: "close_item" } })

const SIGNAL = new AbortController().signal

const undoing = (record: Tally): AgentStepHandler => ({
    kind: "close_item",
    run: () => Promise.resolve({ kind: "failed", code: "x" }),
    compensate: (step) => {
        record.undone.push(step.stepKey)
        return Promise.resolve()
    },
})

const throwing: AgentStepHandler = {
    kind: "close_item",
    run: () => Promise.resolve({ kind: "failed", code: "x" }),
    compensate: () => Promise.reject(new Error("down")),
}

const withoutUndo: AgentStepHandler = { kind: "close_item", run: () => Promise.resolve({ kind: "failed", code: "x" }) }

interface Options {
    readonly commits?: ReadonlyArray<CompensationCommit>
    readonly run?: RunView | null
}

const build = async (
    claims: ReadonlyArray<CompensationClaim>,
    handler: AgentStepHandler | undefined,
    over: Options = {},
) => {
    const record: Tally = { undone: [], told: [] }
    const ledger = mock<AgentStepLedgerService>()
    claims.forEach((claim) => ledger.claimCompensation.mockResolvedValueOnce(claim))
    ;(over.commits ?? ["ok", "ok", "ok"]).forEach((commit) => ledger.commitCompensation.mockResolvedValueOnce(commit))
    const deadLetter = mock<AgentRunDeadLetterService>({
        tell: jest.fn((_workspaceId: string, runId: string, stepKey: string | null, code: string) => {
            record.told.push(`${runId}:${stepKey ?? "-"}:${code}`)
            return Promise.resolve()
        }),
    })
    const store = mock<AgentRunStoreService>({
        runById: jest
            .fn()
            .mockResolvedValue(
                over.run === undefined ? runViewOf({ status: "compensated", errorCode: "boom" }) : over.run,
            ),
    })
    const registry = mock<AgentRunHandlersService>({ of: jest.fn(() => handler) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunCompensationService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentStepLedgerService, useValue: ledger },
            { provide: AgentRunHandlersService, useValue: registry },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunDeadLetterService, useValue: deadLetter },
        ],
    }).compile()
    return { service: container.get(AgentRunCompensationService), ledger, record }
}

describe("AgentRunCompensationService.run when the undo works", () => {
    it("undoes the claimed steps one after the other, then tells a person the run is compensated", async () => {
        const record: Tally = { undone: [], told: [] }
        const { service, record: seen } = await build(
            [{ kind: "claimed", step: door("b") }, { kind: "claimed", step: door("a") }, { kind: "finished" }],
            undoing(record),
        )

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(record.undone).toEqual(["door-b", "door-a"])
        expect(seen.told).toEqual(["run-1:-:boom"])
    })

    it("names the undone run `compensated` when the failure left no code", async () => {
        const { service, record } = await build([{ kind: "finished" }], undefined, { run: null })

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(record.told).toEqual(["run-1:-:compensated"])
    })

    it("looks for the undo under the step's own kind when its effect names none", async () => {
        const record: Tally = { undone: [], told: [] }
        const handler: AgentStepHandler = { ...undoing(record), kind: "door" }
        const plain = stepViewOf({ stepKey: "plain", kind: "door" })
        const { service } = await build([{ kind: "claimed", step: plain }, { kind: "finished" }], handler)

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(record.undone).toEqual(["plain"])
    })
})

describe("AgentRunCompensationService.run when it cannot go on", () => {
    it("stops when the claim is another worker's or the run is not compensating", async () => {
        const busy = await build([{ kind: "busy" }], undefined)
        const closed = await build([{ kind: "closed" }], undefined)

        await busy.service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)
        await closed.service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect([...busy.record.told, ...closed.record.told]).toEqual([])
        expect(busy.ledger.commitCompensation).not.toHaveBeenCalled()
        expect(closed.ledger.commitCompensation).not.toHaveBeenCalled()
    })

    it("keeps a failed undo for another try and stops, telling no one yet", async () => {
        const { service, ledger, record } = await build(
            [{ kind: "claimed", step: door("a") }, { kind: "finished" }],
            throwing,
        )

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(ledger.commitCompensation).toHaveBeenCalledWith(expect.anything(), false, "handler_threw")
        expect(ledger.claimCompensation).toHaveBeenCalledTimes(1)
        expect(record.told).toEqual([])
    })

    it("fails an undo that has no handler, and tells a person when its tries are spent", async () => {
        const { service, ledger, record } = await build([{ kind: "claimed", step: door("a") }], undefined, {
            commits: ["dead"],
        })

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(ledger.commitCompensation).toHaveBeenCalledWith(expect.anything(), false, "no_compensation")
        expect(record.told).toEqual(["run-1:door-a:compensation_failed"])
    })

    it("fails an undo whose handler has no compensate", async () => {
        const { service, ledger, record } = await build([{ kind: "claimed", step: door("a") }], withoutUndo)

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(ledger.commitCompensation).toHaveBeenCalledWith(expect.anything(), false, "no_compensation")
        expect(record.told).toEqual([])
    })

    it("stops when the fence moved on", async () => {
        const record: Tally = { undone: [], told: [] }
        const { service, ledger } = await build(
            [
                { kind: "claimed", step: door("a") },
                { kind: "claimed", step: door("b") },
            ],
            undoing(record),
            { commits: ["fenced"] },
        )

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, SIGNAL)

        expect(ledger.claimCompensation).toHaveBeenCalledTimes(1)
    })

    it("does nothing once the signal is aborted", async () => {
        const stop = new AbortController()
        stop.abort()
        const { service, ledger } = await build([{ kind: "finished" }], undefined)

        await service.run({ workspaceId: "ws-1", runId: "run-1" }, stop.signal)

        expect(ledger.claimCompensation).not.toHaveBeenCalled()
    })
})
