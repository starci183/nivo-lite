import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepView } from "@modules/domain/agent-runs"
import { IntentSplitService } from "@modules/domain/agent-turns"
import { ChatTurnService } from "@modules/domain/conversations"
import type { ChatTurnProposal, CustomerTurn } from "@modules/domain/conversations"
import { CustomerDoorStepService } from "./customer-door-step.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"

const contract = {
    intent: "reply_customer",
    label: "Reply",
    risk: "none",
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
}

const trace = {
    versionId: "v-1",
    trigger: "customer_message",
    audience: "customer",
    offered: ["reply_customer"],
    intent: "reply_customer",
    result: "picked",
    detail: "",
    dropped: [],
}

const wake = {
    workspaceId: "ws-1",
    agentId: "a1",
    scopeKey: "conversation:c1",
    wakeId: "wake-1",
    turnId: "turn-1",
    source: "customer",
    eventKey: "m1",
    context: { conversationId: "c1", messageId: "m1", channelEventId: "tg:42:1" },
    actorMemberId: null,
    attempts: 1,
    maxAttempts: 2,
    wakeCreatedAt: "2026-11-01T10:00:00.000Z",
}

const HOLDING: ChatTurnProposal = {
    reply: "holding line",
    needsHuman: true,
    reason: "unclear_outcome",
    proposedAnswer: "",
    detail: { knowledge_gap: null },
}

const stepOf = (
    reading: Readonly<Record<string, unknown>>,
    input: Readonly<Record<string, unknown>> = {},
): StepView => ({
    stepKey: "door",
    nodeKey: "intent_door",
    kind: "door",
    effect: { kind: "pivot" },
    input: { wake, reading, trace, ...input },
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "a1",
    status: "running",
    attempt: 1,
    fence: 1,
    result: null,
    earlier: {},
})

const build = async (loaded: CustomerTurn | null = runtimeTurn) => {
    const added: Array<AgentStepHandler> = []
    const handlers = mock<AgentRunHandlersService>({
        add: jest.fn((handler: AgentStepHandler) => void added.push(handler)),
    })
    const chat = mock<ChatTurnService>({
        turnOf: jest.fn().mockResolvedValue(loaded ?? undefined),
        respond: jest.fn().mockResolvedValue(undefined),
        holdOver: jest.fn().mockResolvedValue(undefined),
    })
    const runtime = mock<CustomerTurnRuntimeService>({
        proposalFrom: jest.fn((text: string): ChatTurnProposal =>
            text === "" ? HOLDING : { reply: "read", needsHuman: false, reason: "", proposedAnswer: "", detail: {} },
        ),
    })
    const split = mock<IntentSplitService>({ fire: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerDoorStepService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: ChatTurnService, useValue: chat },
            { provide: CustomerTurnRuntimeService, useValue: runtime },
            { provide: IntentSplitService, useValue: split },
        ],
    }).compile()
    moduleRef.get(CustomerDoorStepService).onModuleInit()
    return {
        added,
        chat,
        runtime,
        split,
        run: async (step: StepView): Promise<StepAnswer> =>
            (await added[0]?.run(step, new AbortController().signal)) ?? FAILED,
        deadLetter: (step: StepView) => added[0]?.deadLetter?.(step, "boom"),
    }
}

const FAILED: StepAnswer = { kind: "failed", code: "no handler" }

const WITH_ORIGIN = { ...runtimeTurn, origin: { turnId: "turn-1", wakeId: "wake-1" } }

describe("CustomerDoorStepService", () => {
    it("registers the customer door", async () => {
        const { added } = await build()

        expect(added.map((handler) => handler.kind)).toEqual(["door"])
    })

    it("answers a picked intent through respond with the result read as the reply contract, carrying the turn and wake", async () => {
        const { run, chat, runtime } = await build()
        const reading = { kind: "picked", contract, resultText: '{"reply":"50k"}', dropped: [] }

        await expect(run(stepOf(reading))).resolves.toEqual({
            kind: "done",
            result: { replied: true, split: false },
            next: [],
        })

        expect(chat.turnOf).toHaveBeenCalledWith({ conversationId: "c1", messageId: "m1", channelEventId: "tg:42:1" })
        expect(runtime.proposalFrom).toHaveBeenCalledWith('{"reply":"50k"}')
        expect(chat.respond).toHaveBeenCalledWith(WITH_ORIGIN, expect.objectContaining({ reply: "read" }))
    })

    it("takes the safe road as the holding line, a question for a person, the draft kept and the gap the model named", async () => {
        const { run, chat } = await build()
        const gap = { question: "Do you ship abroad?", topic: "shipping | abroad" }
        const reading = {
            kind: "safe",
            cause: "no_intent",
            detail: "none",
            intent: null,
            gap,
            draft: "x".repeat(2000),
        }

        await run(stepOf(reading))

        expect(chat.respond).toHaveBeenCalledWith(WITH_ORIGIN, {
            reply: "holding line",
            needsHuman: true,
            reason: "unclear_outcome",
            proposedAnswer: "x".repeat(1500),
            detail: { knowledge_gap: gap },
        })
    })

    it("splits: writes the follow-up wake and sends nothing to the customer", async () => {
        const { run, chat, split } = await build()

        await expect(run(stepOf({ kind: "split", contract }))).resolves.toEqual({
            kind: "done",
            result: { replied: false, split: true, fired: true },
            next: [],
        })
        expect(split.fire).toHaveBeenCalledWith(expect.objectContaining({ wakeId: "wake-1" }), "reply_customer")
        expect(chat.respond).not.toHaveBeenCalled()
    })

    it("ends without a reply when the message is gone", async () => {
        const { run, chat } = await build(null)
        const reading = { kind: "picked", contract, resultText: '{"reply":"50k"}', dropped: [] }

        await expect(run(stepOf(reading))).resolves.toEqual({
            kind: "done",
            result: { replied: false, skipped: "target_gone" },
            next: [],
        })
        expect(chat.respond).not.toHaveBeenCalled()
    })

    it("ends without a reply when the wake names no message", async () => {
        const { run, chat } = await build()
        const reading = { kind: "picked", contract, resultText: '{"reply":"50k"}', dropped: [] }

        await expect(run(stepOf(reading, { wake: { ...wake, context: {} } }))).resolves.toMatchObject({
            result: { skipped: "target_gone" },
        })
        expect(chat.turnOf).not.toHaveBeenCalled()
    })
})

describe("CustomerDoorStepService > a step that cannot run", () => {
    it("fails a step whose row holds no reading", async () => {
        const { run } = await build()

        await expect(run({ ...stepOf({}), input: { wake } })).resolves.toEqual({
            kind: "failed",
            code: "invalid_step_input",
        })
    })
})

describe("CustomerDoorStepService > a run that died here", () => {
    it("tells the customer the honest holding line when the run died here, with the customer message intact", async () => {
        const { deadLetter, chat } = await build()

        await deadLetter(stepOf({ kind: "split", contract }))

        expect(chat.holdOver).toHaveBeenCalledWith(WITH_ORIGIN, "error")
    })

    it("says nothing for a dead step whose row cannot be read or whose message is gone", async () => {
        const unreadable = await build()
        const gone = await build(null)

        await unreadable.deadLetter({ ...stepOf({}), input: {} })
        await gone.deadLetter(stepOf({ kind: "split", contract }))

        expect(unreadable.chat.holdOver).not.toHaveBeenCalled()
        expect(gone.chat.holdOver).not.toHaveBeenCalled()
    })
})
