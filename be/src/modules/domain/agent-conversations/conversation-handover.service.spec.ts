import { Test } from "@nestjs/testing"
import { IsNull, Not } from "typeorm"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { conversationOf } from "@tests/fixtures/builders/agent-conversations.builder"
import { eventDeliveryOf } from "@tests/fixtures/builders/automation-reactions.builder"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { ConversationOwnershipEventsService } from "@modules/domain/conversation-ownership-events"
import { DealWonEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import { ConversationHandoverService } from "./conversation-handover.service"
import { AgentConversationEntity } from "./persistence/entities"

const SALES = "sales-agent"
const FRONT = "front-agent"
const CONSUMER = "deal_won__conversation_handback"

const MOVE = {
    workspaceId: "ws-1",
    conversationId: "conv-1",
    fromAgentId: FRONT,
    toAgentId: SALES,
    reason: "Need on record",
}

const INSTALLATION: Installation = {
    id: "inst-sales",
    workspaceId: "ws-1",
    module: "sales",
    name: "Sales",
    isMulti: false,
    agentId: SALES,
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
    liveEnabled: false,
    removed: false,
}

const WON = DealWonEvent.create({ workspaceId: "ws-1", leadId: "lead-1", name: "Lan" })

const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `<${key}>`) })

interface Arranged {
    readonly handed?: ReadonlyArray<AgentConversationEntity>
    readonly installation?: Installation | null
    readonly seen?: boolean
}

const build = async ({ handed = [], installation = INSTALLATION, seen = false }: Arranged = {}) => {
    const tx = fakeTransaction(mockEntityManager({ find: [AgentConversationEntity, handed] }))
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(installation) })
    const ownership = mock<ConversationOwnershipEventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const inbox = fakeInbox()
    if (seen) inbox.seen(CONSUMER, WON.payload.dedupeKey)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationHandoverService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: INBOX, useValue: inbox },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ConversationOwnershipEventsService, useValue: ownership },
        ],
    }).compile()
    return { service: moduleRef.get(ConversationHandoverService), tx, installations, ownership, inbox }
}

describe("ConversationHandoverService handOver", () => {
    it("moves the conversation, remembers the first front agent and records why, in one transaction", async () => {
        const { service, tx, ownership } = await build()
        const [update] = queueQueryBuilders(tx.em, [{ execute: { raw: [{ id: "conv-1" }] } }])

        await expect(service.handOver(MOVE)).resolves.toBe(true)

        expect(evaluatedCalls(update?.callsOf("set") ?? [], 0)).toEqual([
            [{ agentId: SALES, frontAgentId: "COALESCE(front_agent_id, agent_id)", installationId: "inst-sales" }],
        ])
        expect(update?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :conversationId AND handled_by IS NULL AND agent_id <> :agentId",
                { workspaceId: "ws-1", conversationId: "conv-1", agentId: SALES },
            ],
        ])
        expect(ownership.record).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "ws-1",
                conversationId: "conv-1",
                fromAgentId: FRONT,
                toAgentId: SALES,
                reason: "Need on record",
            }),
        )
        expect(tx.commits).toBe(1)
    })

    it("keeps the conversation's installation when the agent has none, and records nothing when it did not move", async () => {
        const { service, tx, ownership } = await build({ installation: null })
        const [update] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])

        await expect(service.handOver(MOVE)).resolves.toBe(false)

        expect(evaluatedCalls(update?.callsOf("set") ?? [], 0)).toEqual([
            [
                {
                    agentId: SALES,
                    frontAgentId: "COALESCE(front_agent_id, agent_id)",
                    installationId: "installation_id",
                },
            ],
        ])
        expect(ownership.record).not.toHaveBeenCalled()
    })

    it("reads an update that answered no rows as not moved (a person holds it, or that agent already speaks)", async () => {
        const { service, tx, ownership } = await build()
        queueQueryBuilders(tx.em, [{ execute: { raw: "not rows" } }])

        await expect(service.handOver(MOVE)).resolves.toBe(false)
        expect(ownership.record).not.toHaveBeenCalled()
    })

    it("rolls the move back when the record fails", async () => {
        const { service, tx, ownership } = await build()
        queueQueryBuilders(tx.em, [{ execute: { raw: [{ id: "conv-1" }] } }])
        ownership.record.mockRejectedValueOnce(new Error("insert failed"))

        await expect(service.handOver(MOVE)).rejects.toThrow("insert failed")
        expect(tx.rollbacks).toBe(1)
    })
})

describe("ConversationHandoverService handBack", () => {
    const sales = conversationOf({ id: "conv-1", agentId: SALES, frontAgentId: FRONT, leadId: "lead-1" })

    it("returns each conversation of the won customer that Sales speaks in to the front agent and records it", async () => {
        const { service, tx, ownership, inbox, installations } = await build({
            handed: [sales, conversationOf({ ...sales, id: "conv-2" })],
        })
        queueQueryBuilders(tx.em, [{ execute: { raw: [{ id: "conv-1" }] } }, { execute: { raw: [{ id: "conv-2" }] } }])

        await service.handBack(eventDeliveryOf(CONSUMER, WON))

        expect(inbox.claims).toEqual([{ source: CONSUMER, eventId: WON.payload.dedupeKey }])
        expect(installations.ofAgent).toHaveBeenCalledWith("ws-1", FRONT)
        expect(
            ownership.record.mock.calls.map(([call]) => [call.conversationId, call.fromAgentId, call.toAgentId]),
        ).toEqual([
            ["conv-1", SALES, FRONT],
            ["conv-2", SALES, FRONT],
        ])
        expect(ownership.record.mock.calls[0]?.[0].reason).toBe("<handover.dealWon>")
        expect(tx.commits).toBe(1)
    })

    it("looks only at conversations nobody holds and that another agent speaks in, locked for the move", async () => {
        const { service, tx } = await build({ handed: [conversationOf({ ...sales, frontAgentId: SALES })] })

        await service.handBack(eventDeliveryOf(CONSUMER, WON))

        expect(tx.em.find).toHaveBeenCalledWith(
            AgentConversationEntity,
            expect.objectContaining({
                where: {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "customer",
                    frontAgentId: Not(IsNull()),
                    handledBy: IsNull(),
                },
                lock: { mode: "pessimistic_write" },
            }),
        )
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("leaves a conversation a person took over in the meantime where it is", async () => {
        const { service, tx, ownership } = await build({ handed: [sales] })
        queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])

        await service.handBack(eventDeliveryOf(CONSUMER, WON))

        expect(ownership.record).not.toHaveBeenCalled()
    })

    it("changes nothing for a delivery it already claimed", async () => {
        const { service, tx, ownership } = await build({ handed: [sales], seen: true })

        await service.handBack(eventDeliveryOf(CONSUMER, WON))

        expect(tx.em.find).not.toHaveBeenCalled()
        expect(ownership.record).not.toHaveBeenCalled()
    })

    it("does nothing for a customer with no conversation handed over", async () => {
        const { service, ownership } = await build({ handed: [] })

        await service.handBack(eventDeliveryOf(CONSUMER, WON))

        expect(ownership.record).not.toHaveBeenCalled()
    })
})
