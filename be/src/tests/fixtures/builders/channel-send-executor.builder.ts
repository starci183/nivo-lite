import { Test } from "@nestjs/testing"
import { FakeClock, mock, type MockOf } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import type { ContactIdentity, ContactWithIdentities } from "@modules/domain/contacts/contacts.contracts"
import { GraphNodeRegistryService, type NodeEffectExecutor, type NodeTurn } from "@modules/domain/graph-nodes"
import { AgentAccountsService } from "@modules/domain/tools"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ChannelSendExecutorService } from "@modules/domain/chat-node-ports"
import { CHANNEL_DELIVERY_STORE } from "@modules/domain/customer-routes/channel-delivery-store.port"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes/channel-deliveries.service"
import { CustomerMessagesService } from "@modules/domain/customer-routes/customer-messages.service"
import { CUSTOMER_ROUTE_STORE } from "@modules/domain/customer-routes/customer-route-store.port"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { MemoryChannelDeliveryStore, MemoryCustomerRouteStore } from "./customer-routes-stores.builder"

/** The instant the channel send specs run at. */
export const NOW: Date = new Date("2026-11-04T10:00:00.000Z")

/** The person the specs write to, and the Telegram account and user id the person came in on. */
export const PERSON = "k-1"
/** The Telegram connection the person came in on. */
export const TELEGRAM_ACCOUNT = "k1"

/** The turn the send specs speak for: woken on the person's Telegram route (`route-1`, the first route the stores make). */
export const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "route-1",
    contactId: PERSON,
    locale: "vi",
}

/** A channel identity of the person, with the given fields changed. */
export const identity = (overrides: Partial<ContactIdentity> = {}): ContactIdentity => ({
    id: "i-1",
    contactId: PERSON,
    verified: true,
    verifiedBy: "channel",
    source: "channel",
    joinedBy: null,
    at: "2026-11-01T10:00:00.000Z",
    kind: "channel",
    provider: "telegram",
    account: TELEGRAM_ACCOUNT,
    value: "555",
    ...overrides,
})

/** The person with the given identities (the Telegram one by default). */
export const contact = (identities: ReadonlyArray<ContactIdentity> = [identity()]): ContactWithIdentities => ({
    id: PERSON,
    workspaceId: "ws-1",
    displayName: "An",
    tags: [],
    state: "active",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    identities,
})

/** Where the sent line goes: the person, the channel, the account and the first route of the stores. */
export const WHERE = { contactId: PERSON, channel: "telegram", accountId: TELEGRAM_ACCOUNT, routeId: "route-1" }

/** The executor beside the scripted collaborators it runs over. */
export interface ChannelSendWorld {
    readonly executor: ChannelSendExecutorService
    readonly registry: MockOf<GraphNodeRegistryService>
    readonly contacts: MockOf<ContactsService>
    readonly routes: CustomerRoutesService
    readonly routeRows: MemoryCustomerRouteStore
    readonly deliveries: ChannelDeliveriesService
    readonly ledger: MemoryChannelDeliveryStore
    readonly delivery: MockOf<ChannelDeliveryService>
    readonly logger: MockOf<Logger>
    readonly memory: MockOf<LeadMemoryService>
    readonly team: MockOf<NodeEffectExecutor>
    readonly access: MockOf<AgentAccountsService>
    readonly connections: MockOf<ConnectionsService>
    /** The engine's own store of the conversation: only `lastHeardAt` (the start of a reply window) is read. */
    readonly lines: MockOf<CustomerMessagesService>
}

/**
 * The executor over the REAL routes and delivery ledger (their memory stores, as the tables keep them) and scripted collaborators, with
 * the defaults every send case starts from: the person is known on Telegram, the run was woken on that route, the
 * channel takes the message.
 */
export const build = async (): Promise<ChannelSendWorld> => {
    const registry = mock<GraphNodeRegistryService>()
    const contacts = mock<ContactsService>()
    const routeRows = new MemoryCustomerRouteStore()
    const ledger = new MemoryChannelDeliveryStore()
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const memory = mock<LeadMemoryService>()
    const team = mock<NodeEffectExecutor>()
    // The accounts judge of a channel-bound send (the attachment to the account: proved on the real service in its own spec; the node's mode is the tool door's).
    const access = mock<AgentAccountsService>()
    const connections = mock<ConnectionsService>()
    const lines = mock<CustomerMessagesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSendExecutorService,
            CustomerRoutesService,
            ChannelDeliveriesService,
            { provide: CUSTOMER_ROUTE_STORE, useValue: routeRows },
            { provide: CHANNEL_DELIVERY_STORE, useValue: ledger },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: ContactsService, useValue: contacts },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: AgentAccountsService, useValue: access },
            { provide: LeadMemoryService, useValue: memory },
            { provide: ConnectionsService, useValue: connections },
            { provide: CustomerMessagesService, useValue: lines },
        ],
    }).compile()
    contacts.get.mockResolvedValue(contact())
    contacts.current.mockImplementation((_workspace, id) => Promise.resolve(id))
    contacts.activeId.mockImplementation((_workspace, id) => Promise.resolve(id))
    contacts.aliasesOf.mockImplementation((_workspace, id) => Promise.resolve([id]))
    // The route the run was woken on: the person's Telegram entrance, the first route of the stores (`route-1`).
    await moduleRef.get(CustomerRoutesService).ensure("ws-1", { contactId: PERSON, channel: "telegram", accountId: TELEGRAM_ACCOUNT })
    delivery.deliverToPerson.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    memory.snapshot.mockResolvedValue(null)
    team.execute.mockResolvedValue({ kind: "chat-message", id: "team-1" })
    registry.optionalExecutorOf.mockImplementation((effect) => (effect === TOOL.teamMessagePost ? team : undefined))
    access.judgeSend.mockResolvedValue({ kind: "allow", provider: "telegram", connectionId: TELEGRAM_ACCOUNT })
    access.judgeEngineLine.mockResolvedValue({ kind: "allow", provider: "telegram", connectionId: TELEGRAM_ACCOUNT })
    access.attachmentOf.mockResolvedValue({ kind: "allow", provider: "telegram", connectionId: TELEGRAM_ACCOUNT })
    connections.find.mockResolvedValue({ id: TELEGRAM_ACCOUNT } as Awaited<ReturnType<ConnectionsService["find"]>>)
    lines.lastHeardAt.mockResolvedValue(null)
    const executor = moduleRef.get(ChannelSendExecutorService)
    return {
        executor,
        registry,
        contacts,
        routes: moduleRef.get(CustomerRoutesService),
        routeRows,
        deliveries: moduleRef.get(ChannelDeliveriesService),
        ledger,
        delivery,
        logger,
        memory,
        team,
        access,
        connections,
        lines,
    }
}

/** A send payload that carries only the words: it speaks to the person the run serves, on the route it was woken on. */
export const SEND = { text: "Hello" }
/** The call a send arrives with: its key and no dedupe key. */
export const CALL = { key: "run:1", dedupeKey: null }

/** The call of the engine's own holding line of a stop: its key says what it is. */
export const HOLDING = { key: "honest-line:run-1:consult", dedupeKey: "honest-line:run-1:consult" }
