import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepView } from "@modules/domain/agent-runs"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InternalProposalSettlerService } from "./internal-proposal-settler.service"
import { IntentSplitService } from "./intent-split.service"
import { IntentTagDoorStepService } from "./intent-tag-door-step.service"
import { IntentTurnService } from "./intent-turn.service"
import type { SettledProposal } from "./agent-turns.contracts"

const contract = {
    intent: "reply_customer",
    label: "Reply",
    risk: "none",
    task: "",
    limits: [],
    result: "agent_request",
    owns: [],
    checks: [],
}

const trace = {
    versionId: "v-1",
    trigger: "tag",
    audience: "manager",
    offered: ["reply_customer"],
    intent: "reply_customer",
    result: "picked",
    detail: "",
    dropped: [],
}

const wake = {
    workspaceId: "ws-1",
    agentId: "agent-kt",
    scopeKey: "agent",
    wakeId: "wake-1",
    turnId: "turn-1",
    source: "tag",
    eventKey: "msg-1",
    context: { messageId: "msg-1", authorUserId: "user-1" },
    actorMemberId: "member-1",
    attempts: 1,
    maxAttempts: 3,
    wakeCreatedAt: "2026-11-01T10:00:00.000Z",
}

const settle = { module: "accounting", actorName: "Lan", locale: "en", installationId: "inst-1" }

const noIntent = {
    kind: "safe",
    cause: "no_intent",
    detail: "none",
    intent: null,
    gap: { question: "Do you ship abroad?", topic: "shipping | abroad" },
    draft: "",
}

const stepOf = (
    reading: Readonly<Record<string, unknown>>,
    over: Readonly<Record<string, unknown>> = {},
): StepView => ({
    stepKey: "door",
    nodeKey: "intent_door",
    kind: "tag_door",
    effect: { kind: "pivot" },
    input: { wake, reading, trace, settle, ...over },
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-kt",
    status: "running",
    attempt: 1,
    fence: 1,
    result: null,
    earlier: {},
})

const APPLIED: SettledProposal = {
    kind: "settled",
    reply: "It is 5tr.",
    needsHuman: false,
    reason: "",
    tasks: 1,
    actions: [{ index: 0, action: "send_invoice", outcome: "requested", workItemId: "item-1" }],
}

const FAILED: StepAnswer = { kind: "failed", code: "no handler" }

const build = async () => {
    const added: Array<AgentStepHandler> = []
    const handlers = mock<AgentRunHandlersService>({
        add: jest.fn((handler: AgentStepHandler) => void added.push(handler)),
    })
    const settler = mock<InternalProposalSettlerService>({ apply: jest.fn().mockResolvedValue(APPLIED) })
    const intents = mock<IntentTurnService>({ raiseGap: jest.fn().mockResolvedValue(undefined) })
    const split = mock<IntentSplitService>({ fire: jest.fn().mockResolvedValue(true) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, _p: unknown, locale: string) => `${key}:${locale}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentTagDoorStepService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: InternalProposalSettlerService, useValue: settler },
            { provide: IntentTurnService, useValue: intents },
            { provide: IntentSplitService, useValue: split },
        ],
    }).compile()
    moduleRef.get(IntentTagDoorStepService).onModuleInit()
    const run = async (step: StepView): Promise<StepAnswer> =>
        (await added[0]?.run(step, new AbortController().signal)) ?? FAILED
    return { added, run, settler, intents, split }
}

describe("IntentTagDoorStepService", () => {
    it("registers the tag door", async () => {
        const { added } = await build()

        expect(added.map((handler) => handler.kind)).toEqual(["tag_door"])
    })

    it("settles the result of a picked intent through the one settler, as the member who tagged, and stores what it did", async () => {
        const { run, settler } = await build()
        const reading = { kind: "picked", contract, resultText: '{"reply":"It is 5tr."}', dropped: [] }

        await expect(run(stepOf(reading))).resolves.toEqual({
            kind: "done",
            result: {
                split: false,
                settled: {
                    reply: "It is 5tr.",
                    needsHuman: false,
                    reason: "",
                    tasks: 1,
                    actions: APPLIED.actions,
                },
            },
            next: [],
        })

        expect(settler.apply).toHaveBeenCalledWith(
            expect.objectContaining({ wakeId: "wake-1", turnId: "turn-1", authorUserId: "user-1", source: "tag" }),
            '{"reply":"It is 5tr."}',
            settle,
        )
    })

    it("answers with a plain line and raises the gap when no intent fits, and does nothing else", async () => {
        const { run, settler, intents } = await build()

        await run(stepOf(noIntent))

        expect(settler.apply).toHaveBeenCalledWith(expect.anything(), "agentTurns.safeRoad:en", settle)
        expect(intents.raiseGap).toHaveBeenCalledWith(
            {
                question: "Do you ship abroad?",
                topic: "shipping | abroad",
                workspaceId: "ws-1",
                agentId: "agent-kt",
                versionId: "v-1",
                trigger: "tag",
            },
            "accounting",
        )
    })

    it.each([
        ["invalid output", { ...noIntent, cause: "invalid_output" }],
        ["a failed check", { ...noIntent, cause: "check_failed", intent: "reply_customer" }],
        ["no gap named", { ...noIntent, gap: null }],
    ])("raises no gap for %s", async (_name, reading) => {
        const { run, intents, settler } = await build()

        await run(stepOf(reading))

        expect(intents.raiseGap).not.toHaveBeenCalled()
        expect(settler.apply).toHaveBeenCalledTimes(1)
    })
})

describe("IntentTagDoorStepService > a turn no intent fits, a split, a row that is not a door", () => {
    it("raises no gap for a picked intent", async () => {
        const { run, intents } = await build()

        await run(stepOf({ kind: "picked", contract, resultText: "{}", dropped: [] }))

        expect(intents.raiseGap).not.toHaveBeenCalled()
    })

    it("splits: writes the follow-up wake and settles nothing", async () => {
        const { run, split, settler } = await build()

        await expect(run(stepOf({ kind: "split", contract }))).resolves.toEqual({
            kind: "done",
            result: { split: true, fired: true },
            next: [],
        })
        expect(split.fire).toHaveBeenCalledWith(expect.objectContaining({ wakeId: "wake-1" }), "reply_customer")
        expect(settler.apply).not.toHaveBeenCalled()
    })

    it("fails a step whose row holds no settle input", async () => {
        const { run } = await build()

        await expect(run({ ...stepOf(noIntent), input: { wake, reading: noIntent, trace } })).resolves.toEqual({
            kind: "failed",
            code: "invalid_step_input",
        })
    })
})
