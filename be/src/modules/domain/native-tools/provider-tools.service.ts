import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesFeedReadService } from "@modules/domain/agent-messages"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import type { GatewayJson, NativeCaller } from "@modules/domain/mcp-gateway"
import { customerMasked, isoTextOf } from "./native-masking.policy"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { PROVIDER_EVENTS_SCHEMA, PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

/** The most connections of one provider a status read lists. */
const CONNECTIONS_MAX = 20

/** The most conversations of one connection the events read looks across. */
const CONVERSATIONS_MAX = 500

/** A channel whose events a tool reads: the provider of its connections and the channel its conversations run on. */
export interface EventChannel {
    /** The provider key of the connections. */
    readonly provider: string
    /** The channel of the conversations. */
    readonly channel: string
}

/** What a provider connector is to the shared tools: its provider, its channel if it has one, and how a connection reads. */
export interface ProviderRoute {
    /** The provider key of the connections. */
    readonly provider: string
    /** The channel of the conversations, or null for a provider that is no channel. */
    readonly channel: string | null
    /** How one connection reads in a `status` answer. */
    readonly line: (connection: ConnectionStatusFacts) => GatewayJson
}

/** What an events read asks for. */
export interface EventsInput {
    /** The connection, which must be the workspace's own. */
    readonly connectionId: string
    /** The most events. */
    readonly limit: number
}

@Injectable()
/**
 * The reads the provider tools share: the connections of a workspace under one provider, and the recent events of one connection read
 * from its conversations and the message feed. An event carries when, which way, whether it was delivered and the customer's id
 * masked: never a body, a visitor name or a provider's raw error.
 */
export class ProviderToolsService {
    constructor(
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly conversations: AgentConversationsReadService,
        private readonly feed: AgentMessagesFeedReadService,
    ) {}

    /** Runs the `status` tool of a provider connector, and its `events` tool when the provider is a channel, for an internal caller only; any other tool is unknown. */
    async answer(
        workspaceId: string,
        route: ProviderRoute,
        tool: string,
        args: GatewayJson,
        caller: NativeCaller,
    ): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status") {
            argumentsOf(tool, PROVIDER_STATUS_SCHEMA, args)
            return { connections: (await this.connectionsOf(workspaceId, route.provider)).map(route.line) }
        }
        if (tool === "events" && route.channel !== null) {
            const input = argumentsOf(tool, PROVIDER_EVENTS_SCHEMA, args)
            return this.eventsOf(workspaceId, { provider: route.provider, channel: route.channel }, input)
        }
        throw unknownTool(tool)
    }

    /** The connections of the workspace under the provider, oldest first; none is `not_connected`. */
    async connectionsOf(workspaceId: string, provider: string): Promise<ReadonlyArray<ConnectionStatusFacts>> {
        const connections = await this.bindings.ofProvider(workspaceId, provider, CONNECTIONS_MAX)
        if (connections.length === 0) throw nativeRefusal("not_connected")
        return connections
    }

    /** The newest events of a connection of the workspace; a connection the workspace does not hold under the provider is `not_found`. */
    async eventsOf(workspaceId: string, target: EventChannel, input: EventsInput): Promise<GatewayJson> {
        const connections = await this.connectionsOf(workspaceId, target.provider)
        if (!connections.some((connection) => connection.id === input.connectionId)) throw nativeRefusal("not_found")
        const conversations = await this.conversations.onConnection(
            workspaceId,
            input.connectionId,
            target.channel,
            CONVERSATIONS_MAX,
        )
        const messages = await this.feed.recentIn(
            conversations.map((conversation) => conversation.id),
            input.limit,
        )
        const customers = new Map(conversations.map((conversation) => [conversation.id, conversation.externalId]))
        return {
            events: messages.map((message) => ({
                at: isoTextOf(message.createdAt),
                direction: message.role === "user" ? "in" : "out",
                delivery: message.role === "user" ? "received" : (message.deliveryStatus ?? "pending"),
                customerMasked: customerMasked(customers.get(message.conversationId) ?? null),
            })),
        }
    }
}
