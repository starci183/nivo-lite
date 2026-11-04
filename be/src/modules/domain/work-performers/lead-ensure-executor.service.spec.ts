import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { AgentConversationReadService, AgentConversationsService } from "@modules/domain/agent-conversations"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { LeadCapturedEvent } from "@modules/events/api"
import type { BaseEvent } from "@modules/platform/event-bus"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { leadOf } from "@tests/fixtures/builders/confirm-order-performer.builder"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { LeadEnsureExecutorService } from "./lead-ensure-executor.service"
import { PerformerKitService } from "./performer-kit.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}
const CALL = { key: "k", dedupeKey: "lead:conv-1" }
const PAYLOAD = { conversationId: "conv-1", channel: "zalo" }

const conversationOf = (overrides: Record<string, unknown> = {}) =>
    ({
        kind: "ok",
        value: {
            id: "conv-1",
            workspaceId: "ws-1",
            leadId: null,
            visitorName: "Khach",
            channel: "zalo",
            externalId: "zalo-user-1",
            ...overrides,
        },
    }) as never

const build = async (withRegistry = true) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key) => key)
    const conversations = mock<AgentConversationsService>()
    conversations.turnOf.mockResolvedValue(conversationOf())
    const contacts = mock<AgentConversationReadService>()
    contacts.leadOfContact.mockResolvedValue(null)
    const leads = mock<LeadRecordsService>()
    leads.match.mockResolvedValue(null)
    leads.capture.mockResolvedValue(leadOf({ id: "lead-new", contact_name: "Lan", phone: "84901234567" }))
    const responsibilities = mock<ResponsibilityJournalService>()
    const bus = recordingEventBus<BaseEvent>()
    const tx = fakeTransaction(mockEntityManager())
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadEnsureExecutorService,
            { provide: PerformerKitService, useValue: kit },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentConversationReadService, useValue: contacts },
            { provide: LeadRecordsService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
            ...(withRegistry ? [{ provide: GraphNodeRegistryService, useValue: registry }] : []),
        ],
    }).compile()
    moduleRef.get(LeadEnsureExecutorService).onModuleInit()
    return {
        conversations,
        contacts,
        leads,
        responsibilities,
        bus,
        tx,
        registry,
        executor: registry.addExecutor.mock.calls[0]?.[0] as NodeEffectExecutor,
    }
}

describe("LeadEnsureExecutorService", () => {
    it("registers the lead.ensure executor, and nothing when the app hosts no graph nodes", async () => {
        const { executor } = await build()
        const { registry } = await build(false)

        expect(executor.effect).toBe("lead.ensure")
        expect(registry.addExecutor).not.toHaveBeenCalled()
    })

    it("answers the lead the conversation already has, and changes nothing", async () => {
        const { conversations, leads, executor } = await build()
        conversations.turnOf.mockResolvedValue(conversationOf({ leadId: "lead-9" }))

        await expect(executor.execute(TURN, PAYLOAD, CALL)).resolves.toEqual({ kind: "sales-lead", id: "lead-9" })

        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).not.toHaveBeenCalled()
        expect(conversations.attachLead).not.toHaveBeenCalled()
    })

    it("creates a lead for a new customer, publishes lead_captured with it, ties the conversation and sets the follow-up", async () => {
        const { conversations, leads, responsibilities, bus, tx, executor } = await build()

        const subject = await executor.execute(TURN, { ...PAYLOAD, name: "Lan", phone: "0901234567" }, CALL)

        expect(subject).toEqual({ kind: "sales-lead", id: "lead-new" })
        expect(leads.capture.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: "ws-1",
            contactName: "Lan",
            channel: "channel.zalo",
            email: null,
        })
        expect(bus.writes.map((event) => event.constructor)).toEqual([LeadCapturedEvent])
        expect(bus.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-new")
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            "lead-new",
        )
    })

    it("names a customer with no name by the conversation, and then by the words for not shared", async () => {
        const { conversations, leads, executor } = await build()
        conversations.turnOf
            .mockResolvedValueOnce(conversationOf())
            .mockResolvedValueOnce(conversationOf({ visitorName: null }))

        await executor.execute(TURN, PAYLOAD, CALL)
        await executor.execute(TURN, PAYLOAD, CALL)

        expect(leads.capture.mock.calls.map(([lead]) => lead.contactName)).toEqual(["Khach", "notShared"])
    })

    it("ties the conversation to a lead the chat's facts already match, and fills the phone it lacked", async () => {
        const { conversations, leads, executor } = await build()
        leads.match.mockResolvedValue(leadOf({ id: "lead-old", phone: null }))

        await expect(executor.execute(TURN, { ...PAYLOAD, phone: "0901234567" }, CALL)).resolves.toEqual({
            kind: "sales-lead",
            id: "lead-old",
        })

        expect(leads.capture).not.toHaveBeenCalled()
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-old",
            phone: expect.any(String),
            email: null,
        })
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-old")
    })

    it("leaves the phone of a matched lead that has one, and fills nothing when the chat gave none", async () => {
        const { leads, executor } = await build()
        leads.match
            .mockResolvedValueOnce(leadOf({ phone: "84900000000" }))
            .mockResolvedValueOnce(leadOf({ phone: null }))

        await executor.execute(TURN, { ...PAYLOAD, phone: "0901234567" }, CALL)
        await executor.execute(TURN, PAYLOAD, CALL)

        expect(leads.fillContact).not.toHaveBeenCalled()
    })

    it("ties a new conversation of a known channel contact to that contact's lead, matching nothing else", async () => {
        const { contacts, leads, conversations, executor } = await build()
        contacts.leadOfContact.mockResolvedValue("lead-contact")

        await expect(executor.execute(TURN, PAYLOAD, CALL)).resolves.toEqual({ kind: "sales-lead", id: "lead-contact" })

        expect(contacts.leadOfContact).toHaveBeenCalledWith("ws-1", "zalo", "zalo-user-1")
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).not.toHaveBeenCalled()
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-contact")
    })

    it("never matches on the guest placeholder: two anonymous senders on the same channel get a lead each", async () => {
        const { conversations, leads, executor } = await build()
        conversations.turnOf
            .mockResolvedValueOnce(conversationOf({ visitorName: "Khách Zalo", externalId: "zalo-user-1" }))
            .mockResolvedValueOnce(
                conversationOf({ id: "conv-2", visitorName: "Khách Zalo", externalId: "zalo-user-2" }),
            )

        await executor.execute(TURN, PAYLOAD, CALL)
        await executor.execute(TURN, { ...PAYLOAD, conversationId: "conv-2" }, CALL)

        expect(leads.match.mock.calls.map(([match]) => match.name)).toEqual([null, null])
        expect(leads.capture).toHaveBeenCalledTimes(2)
    })

    it("matches on a name only when the customer gave it, and asks no contact for a conversation without a channel id", async () => {
        const { conversations, contacts, leads, executor } = await build()
        conversations.turnOf.mockResolvedValue(conversationOf({ externalId: null }))

        await executor.execute(TURN, { ...PAYLOAD, name: "Lan" }, CALL)

        expect(contacts.leadOfContact).not.toHaveBeenCalled()
        expect(leads.match).toHaveBeenCalledWith(expect.objectContaining({ name: "Lan", channel: "channel.zalo" }))
    })

    it.each([
        ["gone", { kind: "refused" }],
        ["another workspace's", conversationOf({ workspaceId: "ws-2" })],
    ])("refuses a conversation that is %s", async (_name, answer) => {
        const { conversations, leads, executor } = await build()
        conversations.turnOf.mockResolvedValue(answer as never)

        await expect(executor.execute(TURN, PAYLOAD, CALL)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ConversationUnavailable,
        })
        expect(leads.capture).not.toHaveBeenCalled()
    })
})
