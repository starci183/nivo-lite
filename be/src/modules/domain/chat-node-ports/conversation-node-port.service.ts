import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { NodeConversationFilter } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { cutFields, limitOf, matchesWhere, statusOf, turnConversationOf } from "./chat-node-ports.policy"

const KIND = "conversation"

/** Narrows a query's `where` to the members the conversations store can filter by. */
const filterOf = (where: NodeQuery["where"]): NodeConversationFilter => ({
    id: typeof where?.id === "string" ? where.id : undefined,
    leadId: typeof where?.leadId === "string" ? where.leadId : undefined,
    channel: typeof where?.channel === "string" ? where.channel : undefined,
})

@Injectable()
/**
 * The data port of the `conversation` kind: the customer conversations of the workspace. A `turn` read reaches only the conversation the
 * turn serves; a `workspace` read reaches the workspace, newest first.
 */
export class ConversationNodePortService implements NodeDataPort, OnModuleInit {
    /** The kind it serves. */
    readonly kind: "conversation" = KIND

    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** The conversations the query asks for, cut to its fields. */
    async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const filter = filterOf(query.where)
        const id = scope === "turn" ? turnConversationOf(turn, filter.id) : (filter.id ?? null)
        if (scope === "turn" && id === null) return []
        const rows = await this.conversations.nodeRows(
            turn.workspaceId,
            { ...filter, id: id ?? undefined },
            limitOf(query),
        )
        const full = await Promise.all(
            rows.map(async (row) => ({
                id: row.id,
                leadId: row.leadId,
                channel: row.channel,
                status: statusOf(row.handledBy),
                lastMessageAt: (await this.messages.latestAt(row.id))?.toISOString() ?? null,
            })),
        )
        return full.filter((row) => matchesWhere(row, query.where)).map((row) => cutFields(row, query.fields))
    }
}
