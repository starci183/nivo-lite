import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { ChatMessageProposeExecutorService } from "./chat-message-propose-executor.service"
import { ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const NOW = new Date("2026-11-06T10:00:00.000Z")
const CONVERSATION = "22222222-2222-4222-8222-222222222222"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: CONVERSATION,
    locale: "vi",
}

const CALL = { key: "k", dedupeKey: null }
const DRAFT = { conversationId: CONVERSATION, text: "We open at 8.", asked: "When do you open?" }

const recordOf = (id: string, data: Readonly<Record<string, unknown>> = {}): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version: "3",
    createdAt: "2026-11-06T09:00:00.000Z",
    updatedAt: "2026-11-06T09:00:00.000Z",
    data,
})

const written = (id: string): EngineResult => ({ ok: true, row: recordOf(id), version: "4", created: true })

const pageOf = (rows: ReadonlyArray<RecordRow>): ListPage => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next: null,
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const registry = mock<GraphNodeRegistryService>()
    const api = mock<EntitiesApi>()
    const tx = mock<ScopedTx>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    ports.entitiesApi.mockReturnValue(api)
    api.get.mockResolvedValue(recordOf(CONVERSATION, { handledBy: null }))
    api.list.mockResolvedValue(pageOf([]))
    api.insert.mockResolvedValue(written("m1"))
    api.update.mockResolvedValue(written("m7"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatMessageProposeExecutorService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    return { executor: moduleRef.get(ChatMessageProposeExecutorService), engine, registry, api }
}

/** The registry double, as far as the spec reads it: the executors the service registered. */
interface RegistryDouble {
    readonly addExecutor: MockedCalls
}

/** A mocked `addExecutor`. */
interface MockedCalls {
    readonly mock: Calls
}

/** The calls of a mocked `addExecutor`. */
interface Calls {
    readonly calls: ReadonlyArray<ReadonlyArray<NodeEffectExecutor>>
}

/** Runs the executor the way the graph host does: through the one the service registered. */
const run = (
    executor: ChatMessageProposeExecutorService,
    registry: RegistryDouble,
    payload: Readonly<Record<string, unknown>>,
) => {
    executor.onModuleInit()
    const registered = registry.addExecutor.mock.calls[0]?.[0]
    assert(registered !== undefined, "The service must register its executor")
    return registered.execute(TURN, payload, CALL)
}

describe("ChatMessageProposeExecutorService", () => {
    it("registers itself with the graph-nodes registry, and does nothing without one", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor.mock.calls[0]?.[0]?.effect).toBe("chat-message.propose")
        const bare = await Test.createTestingModule({
            providers: [
                ChatMessageProposeExecutorService,
                { provide: CLOCK, useValue: new FakeClock(NOW) },
                { provide: EntityEngineService, useValue: mock<EntityEngineService>() },
                { provide: EntityPortsService, useValue: mock<EntityPortsService>() },
            ],
        }).compile()
        expect(() => bare.get(ChatMessageProposeExecutorService).onModuleInit()).not.toThrow()
    })
})

describe("ChatMessageProposeExecutorService executing", () => {
    it("stores the draft as a proposed agent line of the conversation, authored by the AI, and answers it", async () => {
        const { executor, engine, api } = await build()

        await expect(executor.proposeReply(TURN, DRAFT)).resolves.toEqual({ kind: "message", id: "m1" })

        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
        expect(api.insert).toHaveBeenCalledWith(
            "chat.message",
            {
                conversationId: CONVERSATION,
                role: "agent",
                text: "We open at 8.",
                sentAt: NOW.toISOString(),
                authorKind: "ai",
                status: "proposed",
            },
            { conversation: CONVERSATION },
        )
    })

    it("replaces the words of the line that already waits, so a retry or a new draft leaves one proposal", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValue(pageOf([recordOf("m7", { text: "old" })]))

        await expect(executor.proposeReply(TURN, DRAFT)).resolves.toEqual({ kind: "message", id: "m7" })

        expect(api.insert).not.toHaveBeenCalled()
        expect(api.update).toHaveBeenCalledWith("chat.message", "m7", "3", {
            text: "We open at 8.",
            sentAt: NOW.toISOString(),
        })
    })

    it("runs a well-formed payload through the registered executor", async () => {
        const { executor, registry } = await build()
        await expect(run(executor, registry, DRAFT)).resolves.toEqual({ kind: "message", id: "m1" })
    })

    it("refuses a payload that is not a draft", async () => {
        const { executor, api, registry } = await build()
        await expect(run(executor, registry, { conversationId: CONVERSATION })).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
        expect(api.insert).not.toHaveBeenCalled()
    })
})

describe("ChatMessageProposeExecutorService refusing", () => {
    it("refuses a conversation other than the one the turn serves", async () => {
        const { executor } = await build()
        await expect(executor.proposeReply({ ...TURN, conversationId: "other" }, DRAFT)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.WrongConversation,
        })
    })

    it("serves a turn that names no conversation", async () => {
        const { executor } = await build()
        await expect(executor.proposeReply({ ...TURN, conversationId: null }, DRAFT)).resolves.toEqual({
            kind: "message",
            id: "m1",
        })
    })

    it("refuses a conversation the workspace does not have", async () => {
        const { executor, api } = await build()
        api.get.mockResolvedValue(null)
        await expect(executor.proposeReply(TURN, DRAFT)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ConversationNotFound,
        })
    })

    it("proposes nothing in a conversation a person holds", async () => {
        const { executor, api } = await build()
        api.get.mockResolvedValue(recordOf(CONVERSATION, { handledBy: "Thu Ha" }))
        await expect(executor.proposeReply(TURN, DRAFT)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.HeldByPerson,
        })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("fails the step when the engine refuses the write", async () => {
        const { executor, api } = await build()
        api.insert.mockResolvedValue({
            ok: false,
            reason: "taken",
            constraint: "one_proposal_key",
            refusal: "proposal-exists",
        })
        await expect(executor.proposeReply(TURN, DRAFT)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ProposalRefused,
        })
    })
})
