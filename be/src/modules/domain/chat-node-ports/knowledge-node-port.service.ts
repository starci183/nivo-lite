import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { KnowledgeSourcesReadableService } from "@modules/domain/knowledge-sources"
import { cutFields, limitOf, matchesWhere } from "./chat-node-ports.policy"

const KIND = "knowledge-document"

@Injectable()
/**
 * The data port of the `knowledge-document` kind: the indexed documents the turn's agent may read. A `turn` read is the customer's view
 * and reaches only the public documents of the brain; the internal ones need a grant of `workspace` scope.
 */
export class KnowledgeNodePortService implements NodeDataPort, OnModuleInit {
    /** The kind it serves. */
    readonly kind: "knowledge-document" = KIND

    constructor(
        private readonly sources: KnowledgeSourcesReadableService,
        private readonly agents: AgentDirectoryService,
        private readonly conversations: AgentConversationsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** The documents the query asks for, cut to its fields; none when the turn's agent is gone. */
    async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const agent = await this.agents.turnFactsOf(turn.agentId)
        if (agent === null) return []
        const installationId =
            turn.conversationId === null
                ? null
                : await this.conversations.installationIdOf(turn.workspaceId, turn.conversationId)
        const documents = await this.sources.readableFor(
            {
                workspaceId: turn.workspaceId,
                module: agent.module,
                installationId,
                audience: scope === "workspace" ? "internal" : "customer",
            },
            limitOf(query),
        )
        return documents
            .map((document) => ({
                id: document.id,
                title: document.title,
                body: document.content,
                visibility: document.visibility,
            }))
            .filter((row) => matchesWhere(row, query.where))
            .map((row) => cutFields(row, query.fields))
    }
}
