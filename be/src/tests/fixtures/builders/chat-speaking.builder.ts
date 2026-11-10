import type { Provider } from "@nestjs/common"
import { mock, type MockOf } from "@starci/jest-preset"
import {
    AGENTS_INSTALLATIONS,
    AgentDirectoryService,
    type AgentTurnFacts,
    type InstallationDirectory,
} from "@modules/domain/agents"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChannelSendExecutorService } from "@modules/domain/chat-node-ports"
import { ChatConversationsService, ChatEntitiesService, ChatMessagesService } from "@modules/domain/chat-records"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { CHAT_WORKSPACE, fakeChat } from "./chat-records.builder"

/** The customer a spec meets: everything of a meeting but the agent. */
export interface SpeakingCustomer {
    readonly workspaceId: string
    readonly channel: string
    readonly customerId: string
    readonly visitor: string
    readonly connectionId: string
}

/** The chat records a speaking spec runs on: the providers to compile, the doubles it reads, and the wiring of the real send. */
export interface SpeakingChat {
    /** The real conversations and send, with their doubles. */
    readonly providers: ReadonlyArray<Provider>
    /** The line store. */
    readonly messages: MockOf<ChatMessagesService>
    /** The channel. */
    readonly delivery: MockOf<ChannelDeliveryService>
    /** Points the registry at the real send once the module is compiled. */
    readonly wire: (send: ChannelSendExecutorService) => void
}

/** The front door of the shop's connection: it meets every customer line first. */
export const DOOR_AGENT = "33333333-3333-4333-8333-333333333333"

/** The agent a workflow handed the customer to, and that keeps the conversation. */
export const KEEPER_AGENT = "44444444-4444-4444-8444-444444444444"

/** The customer on the shop's connection, as the front door meets them (`meet` without the agent). */
export const SPEAKING_CUSTOMER: SpeakingCustomer = {
    workspaceId: CHAT_WORKSPACE,
    channel: "telegram",
    customerId: "c1",
    visitor: "An",
    connectionId: "22222222-2222-4222-8222-222222222222",
}

const factsOf = (id: string): AgentTurnFacts => ({
    id,
    name: id === DOOR_AGENT ? "Le tan" : "Sales",
    handle: id === DOOR_AGENT ? "le-tan" : "sales",
    role: "sales",
    module: "chatbot",
    instructions: "",
    knowledge: "",
    approvalRule: "",
    greeting: "",
})

/** A turn of an agent's run in the customer's conversation. */
export const speakingTurnOf = (agentId: string, conversationId: string): NodeTurn => ({
    turnId: "run-s1",
    workspaceId: CHAT_WORKSPACE,
    agentId,
    subject: null,
    conversationId,
    locale: "vi",
    origin: "system",
    memberId: null,
    handedOffBy: null,
})

/**
 * The real conversations and the real `channel.send` over an in-memory chat store, with the right to speak as the records keep it; the
 * line store, the channel and the node registry are doubles a spec reads. The registry answers the real send for `channel.send`.
 */
export const speakingChat = (): SpeakingChat => {
    const chat = fakeChat()
    const chatEntities = mock<ChatEntitiesService>()
    chatEntities.run.mockImplementation((_workspace, work) => work(chat.api))
    const agents = mock<AgentDirectoryService>()
    agents.turnFactsOf.mockImplementation((id) => Promise.resolve(factsOf(id)))
    const installations = mock<InstallationDirectory>()
    installations.ofAgent.mockResolvedValue(null)
    const messages = mock<ChatMessagesService>()
    messages.storeAgentLine.mockResolvedValue({ id: "m-out", body: "", sent: false })
    const delivery = mock<ChannelDeliveryService>()
    delivery.deliver.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    const registry = mock<GraphNodeRegistryService>()
    const providers: Array<Provider> = [
        ChatConversationsService,
        ChannelSendExecutorService,
        { provide: ChatEntitiesService, useValue: chatEntities },
        { provide: AgentDirectoryService, useValue: agents },
        { provide: AGENTS_INSTALLATIONS, useValue: installations },
        { provide: ChatMessagesService, useValue: messages },
        { provide: ChannelDeliveryService, useValue: delivery },
        { provide: GraphNodeRegistryService, useValue: registry },
    ]
    const wire = (send: ChannelSendExecutorService): void => {
        registry.optionalExecutorOf.mockImplementation((effect) => (effect === send.effect ? send : undefined))
    }
    return { providers, messages, delivery, wire }
}
