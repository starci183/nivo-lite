import { Injectable } from "@nestjs/common"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatStoredReply } from "@modules/domain/chat-records"
import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { ChannelDeliveryService } from "./channel-delivery.service"
import { CHAT_SEND_INPUT_SCHEMA, CHAT_SEND_SCHEMA } from "./chat-send-native.schema"
import type { ChatSendInput } from "./chat-send-native.schema"

/** The expected reasons `chat.send` refuses with. */
type ChatSendRefusal = "not_found" | "connection_refused" | "delivery_unknown"

/** The refusal of an expected case: an answer to the caller, never a failure of the connector. */
const refusal = (reason: ChatSendRefusal): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason } })

/**
 * The chat capability of the NIVO MCP door: `chat.send` says one text in a customer conversation on its own channel. It is for
 * internal callers only (a declared job or a graph effect), never for a customer or a customer-facing agent.
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
    ) {}

    /** Runs one chat tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, _caller: NativeCaller): Promise<GatewayJson> {
        if (tool !== "send") throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        const parsed = CHAT_SEND_SCHEMA.safeParse(args)
        if (!parsed.success) throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })
        await this.send(workspaceId, parsed.data)
        return { ok: true }
    }

    private async send(workspaceId: string, input: ChatSendInput): Promise<void> {
        const target = await this.conversations.targetOf(workspaceId, input.conversationId)
        if (target.kind !== "ok") throw refusal("not_found")
        const line = await this.lineOf(workspaceId, input)
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
     * never stored twice), else the line stored once under the key.
     */
    private async lineOf(workspaceId: string, input: ChatSendInput): Promise<ChatStoredReply> {
        const known = await this.messages.find(workspaceId, input.conversationId, input.key)
        if (known.kind === "ok")
            return { id: known.value.id, body: known.value.body, sent: known.value.deliveryStatus === "sent" }
        return await this.messages.storeAgentLine({
            workspaceId,
            conversationId: input.conversationId,
            body: input.text,
            key: input.key,
        })
    }
}
