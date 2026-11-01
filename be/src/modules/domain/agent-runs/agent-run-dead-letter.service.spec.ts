import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import type { AgentStepHandler, StepView } from "./agent-runs.contracts"
import type { RunView } from "./agent-runs-engine.contracts"

/** What the scene recorded: who was told, and which runs were marked told. */
interface Tally {
    readonly told: Array<string>
    readonly marked: Array<string>
}

const tally = (): Tally => ({ told: [], marked: [] })

const FAILED_RUN = [
    stepViewOf({ stepKey: "turn", kind: "turn", status: "done" }),
    stepViewOf({ stepKey: "door", kind: "door", status: "failed" }),
]

const speaking = (kind: string, record: Tally): AgentStepHandler => ({
    kind,
    run: () => Promise.resolve({ kind: "failed", code: "x" }),
    deadLetter: (step, code) => {
        record.told.push(`${kind}:${step.stepKey}:${code}`)
        return Promise.resolve()
    },
})

const mute = (kind: string): AgentStepHandler => ({
    kind,
    run: () => Promise.resolve({ kind: "failed", code: "x" }),
})

interface Options {
    readonly run?: RunView | null
    readonly steps?: ReadonlyArray<StepView>
    readonly first?: boolean
}

const build = async (handlers: ReadonlyArray<AgentStepHandler>, record: Tally, over: Options = {}) => {
    const logger = mock<Logger>()
    const store = mock<AgentRunStoreService>({
        runById: jest.fn().mockResolvedValue(over.run === undefined ? runViewOf({ status: "dead" }) : over.run),
        viewsOf: jest.fn().mockResolvedValue(over.steps ?? FAILED_RUN),
        spoken: jest.fn((runId: string) => {
            record.marked.push(runId)
            return Promise.resolve(over.first ?? true)
        }),
    })
    const registry = mock<AgentRunHandlersService>({
        of: jest.fn((kind: string) => handlers.find((handler) => handler.kind === kind)),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunDeadLetterService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunHandlersService, useValue: registry },
        ],
    }).compile()
    return { service: container.get(AgentRunDeadLetterService), logger }
}

describe("AgentRunDeadLetterService.tell", () => {
    it("tells a person through the handler of the failed step, once, then marks the run told", async () => {
        const record = tally()
        const { service } = await build([speaking("door", record), speaking("turn", record)], record)

        await service.tell("run-1", "door", "connector_timeout")

        expect(record.told).toEqual(["door:door:connector_timeout"])
        expect(record.marked).toEqual(["run-1"])
    })

    it("finds the failed step itself when the caller does not name it", async () => {
        const record = tally()
        const { service } = await build([speaking("door", record)], record)

        await service.tell("run-1", null, "x")

        expect(record.told).toEqual(["door:door:x"])
    })

    it("speaks through another step of the run when the failed step's kind cannot", async () => {
        const record = tally()
        const { service } = await build([mute("door"), speaking("turn", record)], record)

        await service.tell("run-1", "door", "x")

        expect(record.told).toEqual(["turn:door:x"])
    })

    it("speaks through the first step that can when no step is marked failed", async () => {
        const record = tally()
        const { service } = await build([speaking("turn", record)], record, {
            run: runViewOf({ status: "compensated" }),
            steps: [stepViewOf({ stepKey: "turn", kind: "turn", status: "done" })],
        })

        await service.tell("run-1", null, "compensated")

        expect(record.told).toEqual(["turn:turn:compensated"])
    })
})

describe("AgentRunDeadLetterService.tell when there is nothing to do or nothing works", () => {
    it("does nothing for a run that was told already, or is gone", async () => {
        const record = tally()
        const told = await build([speaking("door", record)], record, { run: runViewOf({ status: "dead", spoken: true }) })
        const gone = await build([speaking("door", record)], record, { run: null })

        await told.service.tell("run-1", "door", "x")
        await gone.service.tell("run-1", "door", "x")

        expect(record.told).toEqual([])
        expect(record.marked).toEqual([])
    })

    it("leaves the run untold when the handler throws, so the sweep tells again", async () => {
        const record = tally()
        const failing: AgentStepHandler = {
            kind: "door",
            run: () => Promise.resolve({ kind: "failed", code: "x" }),
            deadLetter: () => Promise.reject(new Error("down")),
        }
        const { service, logger } = await build([failing], record)

        await service.tell("run-1", "door", "x")

        expect(record.marked).toEqual([])
        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.DeadLetterFailed, expect.any(Error), expect.anything())
    })

    it("logs a run no handler can tell and marks it, so the sweep does not repeat for ever", async () => {
        const record = tally()
        const { service, logger } = await build([mute("door")], record)

        await service.tell("run-1", "door", "x")

        expect(record.marked).toEqual(["run-1"])
        expect(logger.warn).toHaveBeenCalledWith(AgentRunsLogEvent.DeadWithoutVoice, expect.anything())
    })

    it("does not log a telling that another worker marked first", async () => {
        const record = tally()
        const { service, logger } = await build([speaking("door", record)], record, { first: false })

        await service.tell("run-1", "door", "x")

        expect(record.told).toEqual(["door:door:x"])
        expect(logger.info).not.toHaveBeenCalled()
    })
})
