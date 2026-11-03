import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { cutFields, limitOf, matchesWhere, turnConversationOf } from "./chat-node-ports.policy"

const KIND = "message"

@Injectable()
/**
 * The data port of the `message` kind: the messages of one conversation, newest first. A `turn` read reaches the conversation the turn
 * serves; a `workspace` read names the conversation in `where.conversationId`, and it must be a conversation of the workspace.
 */
export class MessageNodePortService implements NodeDataPort, OnModuleInit {
    /** The kind it serves. */
    readonly kind: "message" = KIND

    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** The messages the query asks for, cut to its fields; none when no conversation of the workspace is named. */
    async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const wanted = query.where?.conversationId
        const named = typeof wanted === "string" ? wanted : null
        const conversationId = scope === "turn" ? turnConversationOf(turn, wanted) : named
        if (conversationId === null) return []
        const owned = await this.conversations.nodeRows(turn.workspaceId, { id: conversationId }, 1)
        if (owned.length === 0) return []
        const stored = await this.messages.nodeRows(turn.workspaceId, conversationId, limitOf(query))
        const rows: ReadonlyArray<NodeRow> = stored.map((row) => ({ ...row }))
        return rows.filter((row) => matchesWhere(row, query.where)).map((row) => cutFields(row, query.fields))
    }
}
