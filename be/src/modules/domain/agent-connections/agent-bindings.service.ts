import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    INBOUND_MODULES,
    PURPOSES,
    boundAgentsOf,
    boundConnectionsOf,
    handoversFrom,
    purposesOf,
    splitRoute,
} from "./agent-bindings.policy"
import type {
    AgentsForOptions,
    BindingGrant,
    BindingTarget,
    BoundAgent,
    BoundConnection,
    ConnectionsForOptions,
    InboundRoute,
    ModuleRef,
    OptionalConnectionId,
    PurposeSelector,
} from "./agent-connections.contracts"
import { AgentConnectionsError, AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import type { BindingKeyRow, BoundAgentRow, BoundConnectionRow } from "./persistence/agent-connections.rows"
import {
    DELETE_BINDING,
    LIST_AGENTS_OF_CONNECTION,
    LIST_CONNECTIONS_OF_AGENT,
    LIST_CONNECTIONS_OF_WORKSPACE_AGENT,
    UPSERT_BINDING,
} from "./persistence/agent-connections.sql"

/** Who may change which agent uses which connection. */
const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/**
 * The one resolver of "which agent listens and speaks on which connection". agent_connections (agent, connection, purpose, access) is
 * the single source: webhooks, the chat turn, outbound delivery and the shift notifier all ask here and nobody guesses "the first
 * connected Telegram" on their own. Only active agents count; with `acting`, a binding whose access is "read" does not count. The
 * reads take ids a verified source resolved (a webhook's connection, a conversation's agent); the grants require a manager.
 */
export class AgentBindingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The active agents bound to a connection for the purpose(s), oldest first. */
    async agentsFor(
        connectionId: string,
        purpose: PurposeSelector,
        options: AgentsForOptions = {},
    ): Promise<ReadonlyArray<BoundAgent>> {
        const rows = await this.entityManager.query<Array<BoundAgentRow>>(LIST_AGENTS_OF_CONNECTION, [
            connectionId,
            purposesOf(purpose),
        ])
        return boundAgentsOf(rows, options)
    }

    /** The connections an agent is bound to for the purpose(s), oldest first; disconnected ones never count. */
    async connectionsFor(
        agentId: string,
        purpose: PurposeSelector,
        options: ConnectionsForOptions = {},
    ): Promise<ReadonlyArray<BoundConnection>> {
        const rows = await this.entityManager.query<Array<BoundConnectionRow>>(LIST_CONNECTIONS_OF_AGENT, [
            agentId,
            purposesOf(purpose),
        ])
        return boundConnectionsOf(rows, options)
    }

    /** Every connection granted to an agent of the caller's workspace, whatever the purpose; any member may look. */
    async connectionsOfAgent(
        userId: string,
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<BoundConnection>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.query<Array<BoundConnectionRow>>(LIST_CONNECTIONS_OF_WORKSPACE_AGENT, [
            agentId,
            workspaceId,
            PURPOSES,
        ])
        return boundConnectionsOf(rows, {})
    }

    /** Inbound chat: the front door agent of a connection and the agents it hands over to. */
    async routeInbound(connectionId: string): Promise<InboundRoute> {
        return splitRoute(
            await this.agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES }),
        )
    }

    /** The agents a conversation's own agent can hand over to; none for a conversation without a connection (website chat). */
    async handoversOf(connectionId: OptionalConnectionId, agent: ModuleRef): Promise<ReadonlyArray<BoundAgent>> {
        if (connectionId === null) return []
        const bound = await this.agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES })
        return handoversFrom(bound, agent.module)
    }

    /** Grants a connection to an agent of the same workspace, or changes the grant; a manager only. */
    async grant(userId: string, grant: BindingGrant): Promise<void> {
        await this.members.require(userId, grant.workspaceId, GOVERNORS)
        const rows = await this.entityManager.query<Array<BindingKeyRow>>(UPSERT_BINDING, [
            grant.agentId,
            grant.connectionId,
            grant.workspaceId,
            grant.purpose,
            grant.access,
        ])
        if (rows.length === 0) {
            throw new AgentConnectionsError({
                code: AgentConnectionsErrorCode.TargetNotFound,
                params: { agentId: grant.agentId, connectionId: grant.connectionId },
            })
        }
    }

    /** Removes the grant of a connection to an agent; a manager only. */
    async revoke(userId: string, target: BindingTarget): Promise<void> {
        await this.members.require(userId, target.workspaceId, GOVERNORS)
        await this.entityManager.query(DELETE_BINDING, [target.agentId, target.connectionId, target.workspaceId])
    }
}
