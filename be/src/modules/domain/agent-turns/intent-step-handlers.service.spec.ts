import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepView } from "@modules/domain/agent-runs"
import type { IntentContract, IntentReading, IntentTrace } from "@modules/domain/intent-contracts"
import { IntentStepHandlersService } from "./intent-step-handlers.service"
import { IntentTurnService } from "./intent-turn.service"

const contract: IntentContract = {
    intent: "reply_customer",
    label: "Reply",
    ownTurn: false,
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
}

const plan = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    pinned: null,
    contracts: [contract],
}

const trace: IntentTrace = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    offered: ["reply_customer"],
    intent: "reply_customer",
    result: "picked",
    detail: "",
    dropped: [],
}

const stepOf = (kind: string, input: Readonly<Record<string, unknown>>): StepView => ({
    stepKey: kind,
    nodeKey: kind,
    kind,
    effect: { kind: "read" },
    input,
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    status: "running",
    attempt: 1,
    fence: 1,
    result: null,
    earlier: {},
})

const FAILED: StepAnswer = { kind: "failed", code: "no handler" }

const build = async (reading: IntentReading) => {
    const added: Array<AgentStepHandler> = []
    const handlers = mock<AgentRunHandlersService>({
        add: jest.fn((handler: AgentStepHandler) => void added.push(handler)),
    })
    const intents = mock<IntentTurnService>({ readingOf: jest.fn(() => reading), traceOf: jest.fn(() => trace) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentStepHandlersService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: IntentTurnService, useValue: intents },
        ],
    }).compile()
    moduleRef.get(IntentStepHandlersService).onModuleInit()
    const run = async (kind: string, input: Readonly<Record<string, unknown>>): Promise<StepAnswer> =>
        (await added
            .find((candidate) => candidate.kind === kind)
            ?.run(stepOf(kind, input), new AbortController().signal)) ?? FAILED
    return { run, added, intents }
}

const picked: IntentReading = { kind: "picked", contract, result: { reply: "hi" }, dropped: [] }

describe("IntentStepHandlersService", () => {
    it("registers the turn step and the read step", async () => {
        const { added } = await build(picked)

        expect(added.map((handler) => handler.kind)).toEqual(["turn", "read_result"])
    })

    it("keeps the model's text as the result of the turn step", async () => {
        const { run } = await build(picked)

        await expect(run("turn", { text: "hello" })).resolves.toEqual({
            kind: "done",
            result: { text: "hello" },
            next: [],
        })
    })

    it("fails a turn step whose row holds no text", async () => {
        const { run } = await build(picked)

        await expect(run("turn", {})).resolves.toEqual({ kind: "failed", code: "invalid_step_input" })
    })

    it("reads the text against the contracts of the row, and keeps the reading as a row holds it with its trace", async () => {
        const { run, intents } = await build(picked)

        await expect(run("read_result", { plan, text: "{}" })).resolves.toEqual({
            kind: "done",
            result: {
                reading: { kind: "picked", contract, resultText: '{"reply":"hi"}', dropped: [] },
                trace,
            },
            next: [],
        })
        expect(intents.readingOf).toHaveBeenCalledWith("{}", plan)
    })

    it("fails a read step whose row holds no plan", async () => {
        const { run } = await build(picked)

        await expect(run("read_result", { text: "{}" })).resolves.toEqual({
            kind: "failed",
            code: "invalid_step_input",
        })
    })

    it("turns a reading a row cannot hold into the safe road, never a failed step", async () => {
        const huge: IntentReading = { kind: "picked", contract, result: { reply: "x".repeat(40_001) }, dropped: [] }
        const { run } = await build(huge)

        await expect(run("read_result", { plan, text: "{}" })).resolves.toEqual({
            kind: "done",
            result: {
                reading: {
                    kind: "safe",
                    cause: "invalid_output",
                    detail: "unstorable_reading",
                    intent: null,
                    gap: null,
                    draft: "",
                },
                trace,
            },
            next: [],
        })
    })
})
