import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { NodeQuery, ReadScope } from "@nivo-lite/agent-sdk/node"
import { AgentDirectoryService, InjectInstallations, type InstallationDirectory } from "@modules/domain/agents"
import { GraphNodeRegistryService, type NodeDataPort, type NodeRow, type NodeTurn } from "@modules/domain/graph-nodes"
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
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** The documents the query asks for, cut to its fields; none when the turn's agent is gone. */
    async read(turn: NodeTurn, query: NodeQuery, scope: ReadScope): Promise<ReadonlyArray<NodeRow>> {
        const agent = await this.agents.turnFactsOf(turn.agentId)
        if (agent === null) return []
        const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
        const documents = await this.sources.readableFor(
            {
                workspaceId: turn.workspaceId,
                module: agent.module,
                installationId: installation?.id ?? null,
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
