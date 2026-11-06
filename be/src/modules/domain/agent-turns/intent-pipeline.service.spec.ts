import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { StepJson, StepSpec } from "@modules/domain/agent-runs"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IntentPipelineService } from "./intent-pipeline.service"
import { IntentTurnService } from "./intent-turn.service"
import type { IntentPlan, IntentRead, IntentReadingRow } from "./agent-turns.contracts"

const contract = {
    intent: "reply_customer",
    label: "Reply",
    ownTurn: false,
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
} as const

const plan: IntentPlan = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    pinned: null,
    contracts: [contract],
}

const turn: AgentTurnView = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    scopeKey: "conversation:conv-1",
    wakeId: "wake-1",
    source: "customer",
    eventKey: "msg-1",
    context: { conversationId: "conv-1" },
    actorMemberId: null,
    attempts: 1,
    maxAttempts: 2,
    wakeCreatedAt: new Date("2026-11-01T10:00:00.000Z"),
    fence: 1,
    turnId: "turn-1",
    proposal: null,
}

const trace = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    offered: ["reply_customer"],
    intent: "reply_customer",
    result: "picked",
    detail: "",
    dropped: [],
} as const

const picked: IntentReadingRow = { kind: "picked", contract, resultText: "{}", dropped: [] }

const build = async (answers: Readonly<Record<string, StepJson>>) => {
    const tx = fakeTransaction(mockEntityManager())
    const runs = mock<AgentRunsService>({
        open: jest.fn(() => Promise.resolve(mock({}))),
        runInline: jest.fn((_workspaceId: string, _wakeId: string, spec: StepSpec) =>
            Promise.resolve(answers[spec.stepKey] ?? {}),
        ),
    })
    const intents = mock<IntentTurnService>({
        nodeKeysOf: jest.fn().mockResolvedValue({ turn: "understand", acts: { reply_customer: "answer" } }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentPipelineService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentRunsService, useValue: runs },
            {
                provide: IntentTurnService,
                useValue: intents,
            },
        ],
    }).compile()
    return { service: moduleRef.get(IntentPipelineService), runs, intents }
}

const signal = new AbortController().signal

describe("IntentPipelineService > open", () => {
    it("opens the one run of the wake with its context intact, in a transaction of its own", async () => {
        const { service, runs } = await build({})

        await service.open(turn, plan)

        expect(runs.open).toHaveBeenCalledWith(expect.anything(), {
            planning: true,
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "customer_message",
            versionId: "v-1",
            context: { conversationId: "conv-1" },
        })
    })
})

describe("IntentPipelineService > read", () => {
    it("keeps the text on the run, reads it from the row, and answers the reading and its trace", async () => {
        const { service, runs, intents } = await build({
            turn: { text: "model text" },
            read_result: { reading: picked, trace },
        })

        await expect(service.read(turn, plan, "model text", signal)).resolves.toEqual({ reading: picked, trace })

        expect(runs.open).toHaveBeenCalledTimes(1)
        expect(intents.nodeKeysOf).toHaveBeenCalledWith("ws-1", "agent-1", "customer_message", "customer")
        const [first, second] = jest.mocked(runs.runInline).mock.calls
        expect(first?.[1]).toBe("wake-1")
        expect(first?.[2]).toEqual({
            stepKey: "turn",
            nodeKey: "understand",
            kind: "turn",
            effect: { kind: "read" },
            input: { text: "model text" },
        })
        expect(second?.[2]).toEqual({
            stepKey: "read_result",
            nodeKey: "understand",
            kind: "read_result",
            effect: { kind: "read" },
            input: { plan, text: "model text" },
        })
    })

    it("reads the text a replayed turn step stored, never the one it was given again", async () => {
        const { service, runs } = await build({
            turn: { text: "stored text" },
            read_result: { reading: picked, trace },
        })

        await service.read(turn, plan, "new text", signal)

        expect(jest.mocked(runs.runInline).mock.calls[1]?.[2].input).toEqual({ plan, text: "stored text" })
    })

    it("cuts a text longer than a row holds", async () => {
        const { service, runs } = await build({})

        await service.read(turn, plan, "x".repeat(50_000), signal)

        expect(jest.mocked(runs.runInline).mock.calls[0]?.[2].input).toEqual({ text: "x".repeat(40_000) })
    })

    it("takes the safe road when the stored reading cannot be read back", async () => {
        const { service } = await build({ turn: { text: "t" }, read_result: { junk: true } })

        await expect(service.read(turn, plan, "t", signal)).resolves.toEqual({
            reading: {
                kind: "safe",
                cause: "invalid_output",
                detail: "unreadable_step",
                intent: null,
                gap: null,
                draft: "",
            },
            trace: { ...trace, intent: null, result: "invalid_output", detail: "unreadable_step" },
        })
    })
})

describe("IntentPipelineService > door", () => {
    it("runs the door of the trigger as a pivot, with the wake, the reading and the trace on its row", async () => {
        const { service, runs, intents } = await build({ door: { replied: true } })
        const read: IntentRead = { reading: picked, trace }

        await expect(service.door(turn, "door", read, signal)).resolves.toEqual({ replied: true })
        expect(intents.nodeKeysOf).toHaveBeenCalledWith("ws-1", "agent-1", "customer_message", "customer")

        const [, wakeId, spec] = jest.mocked(runs.runInline).mock.calls[0] ?? []
        expect(wakeId).toBe("wake-1")
        expect(spec).toMatchObject({
            stepKey: "door",
            nodeKey: "answer",
            kind: "door",
            effect: { kind: "pivot" },
            input: { reading: picked, trace, wake: { wakeId: "wake-1", turnId: "turn-1" } },
        })
    })

    it("hands a tag door the settle input it applies the proposal under", async () => {
        const { service, runs } = await build({ door: { split: false } })
        const settle = { module: "accounting", actorName: "Lan", locale: "vi", installationId: null } as const

        await service.door(turn, "tag_door", { reading: picked, trace }, signal, { settle })

        expect(jest.mocked(runs.runInline).mock.calls[0]?.[2]).toMatchObject({
            kind: "tag_door",
            input: { settle },
        })
    })
})
