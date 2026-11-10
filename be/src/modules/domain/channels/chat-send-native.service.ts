import { Injectable } from "@nestjs/common"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatStoredReply } from "@modules/domain/chat-records"
import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { ChannelCustomerProfileService } from "./channel-customer-profile.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import {
    CHAT_PROFILE_INPUT_SCHEMA,
    CHAT_PROFILE_SCHEMA,
    CHAT_SEND_INPUT_SCHEMA,
    CHAT_SEND_SCHEMA,
} from "./chat-send-native.schema"
import type { ChatSendInput } from "./chat-send-native.schema"

/** The shape of the id of a record: only a replay key of this shape can name a line already stored in the conversation. */
const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The expected reasons `chat.send` and `chat.profile` refuse with. */
type ChatSendRefusal = "not_found" | "held_by_person" | "connection_refused" | "delivery_unknown" | "profile_unavailable"

/** The refusal of an expected case: an answer to the caller, never a failure of the connector. */
const refusal = (reason: ChatSendRefusal): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason } })

/**
 * The chat capability of the NIVO MCP door, for the declared jobs of the modules only (never a step's agent, which says something to a
 * customer through `customer.message.send` alone): `chat.send` delivers a line of a customer conversation on its own channel, and
 * `chat.profile` reads what that channel says of the customer (name and picture). `chat.send` is the outbox delivery of a line a person
 * stored (a reply, an approved draft: the action that stored it checked the person may speak), named by its id as the key; a declared
 * job's own notice (a payment confirmation) is stored once under its key and holds the agent's rule that nothing is said over a person
 * who holds the conversation. The Zalo window, its ZNS fallback and the recipient are the channel layer's, as for every send.
 */
export const CHAT_MANIFEST: NativeConnectorManifest = {
    key: "chat",
    name: "Chat",
    kind: "native",
    contractVersion: "chat-native@1",
    tools: [
        {
            name: "send",
            description:
                "Says one text in a customer conversation on the channel it came in on. The same key is the same line: it is stored and sent once.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: CHAT_SEND_INPUT_SCHEMA,
            argumentSchema: CHAT_SEND_SCHEMA,
            idempotencyArg: "key",
            domain: "chat.send",
            internalOnly: true,
        },
        {
            name: "profile",
            description:
                "Reads what the channel says of the customer of a conversation: their display name and picture link, each empty when the channel gives none. Refused when the channel cannot say.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CHAT_PROFILE_INPUT_SCHEMA,
            argumentSchema: CHAT_PROFILE_SCHEMA,
            domain: "chat.profile",
            internalOnly: true,
        },
    ],
}

@Injectable()
/** Runs the tool of the chat connector: finds or stores the line on the conversation record and delivers it through the channel the conversation came in on. */
export class ChatSendNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = CHAT_MANIFEST

    constructor(
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly delivery: ChannelDeliveryService,
        private readonly customers: ChannelCustomerProfileService,
    ) {}

    /** Runs one chat tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, _caller: NativeCaller): Promise<GatewayJson> {
        if (tool === "profile") return this.profile(workspaceId, args)
        if (tool !== "send") throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        const parsed = CHAT_SEND_SCHEMA.safeParse(args)
        if (!parsed.success) throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })
        await this.send(workspaceId, parsed.data)
        return { ok: true }
    }

    /** What the channel says of the customer of the conversation; refused when the conversation is not there or the channel cannot say. */
    private async profile(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = CHAT_PROFILE_SCHEMA.safeParse(args)
        if (!parsed.success)
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "profile" } })
        const target = await this.conversations.targetOf(workspaceId, parsed.data.conversationId)
        if (target.kind !== "ok") throw refusal("not_found")
        const profile = await this.customers.profileOf(target.value)
        if (profile === null) throw refusal("profile_unavailable")
        return { name: profile.name, avatarUrl: profile.avatarUrl }
    }

    private async send(workspaceId: string, input: ChatSendInput): Promise<void> {
        const [conversation] = await this.conversations.humansOf(workspaceId, [input.conversationId])
        if (conversation === undefined) throw refusal("not_found")
        const line = await this.lineOf(workspaceId, input, conversation.handledBy)
        if (line.sent) return
        const receipt = await this.delivery.deliver({
            workspaceId,
            conversationId: input.conversationId,
            messageId: line.id,
            text: line.body,
        })
        if (receipt.outcome === "ambiguous") throw refusal("delivery_unknown")
        if (!receipt.delivered) throw refusal("connection_refused")
    }

    /**
     * The line to say: the stored line when the key is the id of one of the conversation (a reply a person or an action stored first, so it is
     * never stored twice), else the job's own notice stored once under the key, refused while a person holds the conversation.
     */
    private async lineOf(workspaceId: string, input: ChatSendInput, handledBy: string | null): Promise<ChatStoredReply> {
        const known = MESSAGE_ID.test(input.key)
            ? await this.messages.find(workspaceId, input.conversationId, input.key)
            : null
        if (known?.kind === "ok")
            return { id: known.value.id, body: known.value.body, sent: known.value.deliveryStatus === "sent" }
        if (handledBy !== null) throw refusal("held_by_person")
        return await this.messages.storeAgentLine({
            workspaceId,
            conversationId: input.conversationId,
            body: input.text,
            key: input.key,
        })
    }
}
