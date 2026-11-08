import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { LeadEffectsService } from "./lead-effects.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const CONVERSATION = "22222222-2222-4222-8222-222222222222"
const LEAD = "33333333-3333-4333-8333-333333333333"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: WORKSPACE,
    agentId: "a-1",
    subject: null,
    conversationId: CONVERSATION,
    locale: "vi",
}

const CALL = { key: "k", dedupeKey: null }

const recordOf = (id: string, data: Readonly<Record<string, unknown>> = {}): RecordRow => ({
    id,
    workspaceId: WORKSPACE,
    version: "1",
    createdAt: "2026-11-05T09:00:00.000Z",
    updatedAt: "2026-11-05T09:00:00.000Z",
    data,
})

const written = (id: string, created = true): EngineResult => ({
    ok: true,
    row: recordOf(id),
    version: "1",
    created,
})

const pageOf = (row: RecordRow, leadId: string | null): ListPage => ({
    rows: [
        {
            row,
            joined: { lead: leadId === null ? null : { id: leadId, data: { contactName: "Lan" } } },
            position: [],
            included: {},
        },
    ],
    next: null,
})

const conversationPage = (leadId: string | null): ListPage =>
    pageOf(recordOf(CONVERSATION, { name: "Guest 7", channel: "zalo" }), leadId)

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const registry = mock<GraphNodeRegistryService>()
    const api = mock<EntitiesApi>()
    const tx = mock<ScopedTx>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    ports.entitiesApi.mockReturnValue(api)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadEffectsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(LeadEffectsService).onModuleInit()
    const executor = registry.addExecutor.mock.calls[0]?.[0]
    const resolver = registry.addSubjectResolver.mock.calls[0]?.[0]
    assert(executor !== undefined, "The service must register an executor")
    assert(resolver !== undefined, "The service must register a resolver")
    return { engine, registry, api, executor, resolver }
}

const ensure = (executor: NodeEffectExecutor, payload: Readonly<Record<string, unknown>>): Promise<SubjectRef> =>
    executor.execute(TURN, payload, CALL)

describe("LeadEffectsService registration", () => {
    it("registers the executor of lead.ensure and the resolver of the customer of a turn", async () => {
        const { registry, executor } = await build()
        expect(executor.effect).toBe("lead.ensure")
        expect(registry.addSubjectResolver).toHaveBeenCalledTimes(1)
    })

    it("does nothing when the app hosts no graph nodes", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                LeadEffectsService,
                { provide: EntityEngineService, useValue: mock<EntityEngineService>() },
                { provide: EntityPortsService, useValue: mock<EntityPortsService>() },
            ],
        }).compile()
        expect(() => moduleRef.get(LeadEffectsService).onModuleInit()).not.toThrow()
    })
})

describe("LeadEffectsService lead.ensure makes the customer", () => {
    it("answers the customer the conversation is already linked to and writes nothing", async () => {
        const { executor, api, engine } = await build()
        api.list.mockResolvedValue(conversationPage(LEAD))

        await expect(ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })).resolves.toEqual({
            kind: "sales-lead",
            id: LEAD,
        })

        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function))
        expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ from: "chat.conversation" }))
        expect(api.ensure).not.toHaveBeenCalled()
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("makes the customer through the phone match key, normalised, and links the conversation to it", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValue(conversationPage(null))
        api.ensure.mockResolvedValue(written(LEAD))
        api.link.mockResolvedValue(written(CONVERSATION, false))

        await expect(
            ensure(executor, { conversationId: CONVERSATION, name: "Lan", phone: "0912 000 701", channel: "zalo" }),
        ).resolves.toEqual({ kind: "sales-lead", id: LEAD })

        expect(api.ensure).toHaveBeenCalledWith("sales.lead", "phone", {
            contactName: "Lan",
            channel: "zalo",
            phone: "84912000701",
        })
        expect(api.link).toHaveBeenCalledWith("chat.conversation", CONVERSATION, "lead", LEAD)
    })

    it("makes a customer from the name of the conversation when the chat knows no phone", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValue(conversationPage(null))
        api.insert.mockResolvedValue(written(LEAD))
        api.link.mockResolvedValue(written(CONVERSATION, false))

        await ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })

        expect(api.insert).toHaveBeenCalledWith("sales.lead", { contactName: "Guest 7", channel: "zalo" })
        expect(api.ensure).not.toHaveBeenCalled()
    })

    it("makes a customer with no phone of a phone that holds no digits", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValue(conversationPage(null))
        api.insert.mockResolvedValue(written(LEAD))
        api.link.mockResolvedValue(written(CONVERSATION, false))

        await ensure(executor, { conversationId: CONVERSATION, phone: "n/a", channel: "zalo" })

        expect(api.insert).toHaveBeenCalledTimes(1)
    })
})

describe("LeadEffectsService lead.ensure refuses", () => {
    it.each([
        ["a payload with no conversation", { channel: "zalo" }],
        ["a name that is empty", { conversationId: CONVERSATION, name: "", channel: "zalo" }],
    ])("%s", async (_label, payload) => {
        const { executor } = await build()
        await expect(ensure(executor, payload)).rejects.toMatchObject({ code: "SALES_EFFECTS_INVALID_PAYLOAD" })
    })

    it("a conversation id that is no record id, without looking it up", async () => {
        const { executor, api } = await build()
        await expect(ensure(executor, { conversationId: "not-a-uuid", channel: "zalo" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_CONVERSATION_NOT_FOUND",
        })
        expect(api.list).not.toHaveBeenCalled()
    })

    it("a conversation the workspace has not, and one whose fields are not a conversation's", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValueOnce({ rows: [], next: null })
        await expect(ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_CONVERSATION_NOT_FOUND",
        })
        api.list.mockResolvedValueOnce(pageOf(recordOf(CONVERSATION), null))
        await expect(ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_CONVERSATION_NOT_FOUND",
        })
    })

    it("when the engine does not make the customer, and when it does not make the link", async () => {
        const { executor, api } = await build()
        api.list.mockResolvedValue(conversationPage(null))
        api.insert.mockResolvedValueOnce({ ok: false, reason: "taken", constraint: "phone_key", refusal: "x" })
        await expect(ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
        api.insert.mockResolvedValueOnce(written(LEAD))
        api.link.mockResolvedValueOnce({ ok: false, reason: "stale" })
        await expect(ensure(executor, { conversationId: CONVERSATION, channel: "zalo" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("LeadEffectsService the subject of a turn", () => {
    it("is the customer of the conversation the turn serves", async () => {
        const { resolver, api } = await build()
        api.list.mockResolvedValue(conversationPage(LEAD))
        await expect(resolver.subjectOf(TURN)).resolves.toEqual({ kind: "sales-lead", id: LEAD })
    })

    it("is none when the turn serves no conversation, or the conversation has no customer", async () => {
        const { resolver, api, engine } = await build()
        await expect(resolver.subjectOf({ ...TURN, conversationId: null })).resolves.toBeNull()
        expect(engine.scoped).not.toHaveBeenCalled()
        api.list.mockResolvedValue(conversationPage(null))
        await expect(resolver.subjectOf(TURN)).resolves.toBeNull()
        api.list.mockResolvedValue({ rows: [], next: null })
        await expect(resolver.subjectOf(TURN)).resolves.toBeNull()
    })
})
