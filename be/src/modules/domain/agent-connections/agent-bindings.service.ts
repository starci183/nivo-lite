import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
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
    BoundAgentFacts,
    BoundConnection,
    BoundConnectionFacts,
    ConnectionsForOptions,
    InboundRoute,
    ModuleRef,
    OptionalConnectionId,
    PurposeSelector,
} from "./agent-connections.contracts"
import { AgentConnectionsError, AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

/** Who may change which agent uses which connection. */
const GOVERNORS = ["owner", "manager"] as const

/** The most bindings one read answers. */
const BINDINGS_MAX = 200

@Injectable()
/**
 * The one resolver of "which agent listens and speaks on which connection". agent_connections (agent, connection, purpose, access) is
 * the single source: webhooks, the chat turn, outbound delivery and the shift notifier all ask here and nobody guesses "the first
 * connected Telegram" on their own. Only active agents count; with `acting`, a binding whose access is "read" does not count. The
 * reads take ids a verified source resolved (a webhook connection, a conversation agent); the grants require a manager.
 */
export class AgentBindingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly agents: AgentDirectoryService,
        private readonly connections: ConnectionBindingsReadService,
    ) {}

    /** The active agents bound to a connection for the purpose(s), oldest first. */
    async agentsFor(
        connectionId: string,
        purpose: PurposeSelector,
        options: AgentsForOptions = {},
    ): Promise<ReadonlyArray<BoundAgent>> {
        const links = await this.entityManager.find(AgentConnectionEntity, {
            where: { connectionId, purpose: In([...purposesOf(purpose)]) },
            take: BINDINGS_MAX,
        })
        const [first] = links
        if (first === undefined) return []
        const agents = await this.agents.activeCreatedAmong(
            first.workspaceId,
            links.map((link) => link.agentId),
            BINDINGS_MAX,
        )
        const rows = agents.flatMap((agent) =>
            links
                .filter((link) => link.agentId === agent.id)
                .map((link): BoundAgentFacts => ({
                    id: agent.id,
                    module: agent.module,
                    name: agent.name,
                    created_at: agent.createdAt.toISOString(),
                    access: link.access,
                    purpose: link.purpose,
                })),
        )
        return boundAgentsOf(rows, options)
    }

    /** The connections an agent is bound to for the purpose(s), oldest first; disconnected ones never count. */
    async connectionsFor(
        agentId: string,
        purpose: PurposeSelector,
        options: ConnectionsForOptions = {},
    ): Promise<ReadonlyArray<BoundConnection>> {
        const rows = await this.connectionRows({ agentId, purpose: In([...purposesOf(purpose)]) })
        return boundConnectionsOf(rows, options)
    }

    /** Every connection granted to an agent of the caller workspace, whatever the purpose; any member may look. */
    async connectionsOfAgent(
        userId: string,
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<BoundConnection>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.connectionRows({ agentId, workspaceId, purpose: In([...PURPOSES]) })
        return boundConnectionsOf(rows, {})
    }

    /** Inbound chat: the front door agent of a connection and the agents it hands over to. */
    async routeInbound(connectionId: string): Promise<InboundRoute> {
        return splitRoute(
            await this.agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES }),
        )
    }

    /** The agents a conversation own agent can hand over to; none for a conversation without a connection (website chat). */
    async handoversOf(connectionId: OptionalConnectionId, agent: ModuleRef): Promise<ReadonlyArray<BoundAgent>> {
        if (connectionId === null) return []
        const bound = await this.agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES })
        return handoversFrom(bound, agent.module)
    }

    /** Grants a connection to an agent of the same workspace, or changes the grant; a manager only. */
    async grant(userId: string, grant: BindingGrant): Promise<void> {
        await this.members.require(userId, grant.workspaceId, GOVERNORS)
        const granted = await this.entityManager.transaction((manager) => this.upsert(manager, grant))
        if (!granted) {
            throw new AgentConnectionsError({
                code: AgentConnectionsErrorCode.TargetNotFound,
                params: { agentId: grant.agentId, connectionId: grant.connectionId },
            })
        }
    }

    /** Writes a grant the caller already proved and planned, inside its transaction (the connection grants editor). */
    async writeGrant(grant: BindingGrant, manager: EntityManager = this.entityManager): Promise<void> {
        await this.upsert(manager, grant)
    }

    /** Removes a grant the caller already proved and planned, inside its transaction (the connection grants editor). */
    async removeGrant(target: BindingTarget, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.delete(AgentConnectionEntity, {
            agentId: target.agentId,
            connectionId: target.connectionId,
            workspaceId: target.workspaceId,
        })
    }

    /** Removes the grant of a connection to an agent; a manager only. */
    async revoke(userId: string, target: BindingTarget): Promise<void> {
        await this.members.require(userId, target.workspaceId, GOVERNORS)
        await this.removeGrant(target)
    }

    /** The bindings matching `where` beside the facts of their connections, oldest connection first. */
    private async connectionRows(where: FindOptionsWhere<AgentConnectionEntity>): Promise<Array<BoundConnectionFacts>> {
        const links = await this.entityManager.find(AgentConnectionEntity, { where, take: BINDINGS_MAX })
        const facts = await this.connections.factsOf(
            links.map((link) => link.connectionId),
            BINDINGS_MAX,
        )
        return [...facts]
            .sort(
                (left, right) =>
                    left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
            )
            .flatMap((connection) =>
                links
                    .filter((link) => link.connectionId === connection.id)
                    .map((link): BoundConnectionFacts => ({
                        id: connection.id,
                        provider: connection.provider,
                        name: connection.name,
                        status: connection.status,
                        created_at: connection.createdAt.toISOString(),
                        access: link.access,
                        purpose: link.purpose,
                        bot_username: connection.botUsername,
                        account_masked: connection.accountMasked,
                    })),
            )
    }

    /**
     * Grants (or changes the grant of) a connection to an agent of the same workspace; answers false when either is not in the
     * workspace. Both rows are held while the grant is written, so neither can leave the workspace in between.
     */
    private async upsert(manager: EntityManager, grant: BindingGrant): Promise<boolean> {
        const held =
            (await this.agents.holds(grant.workspaceId, grant.agentId, manager)) &&
            (await this.connections.holds(grant.workspaceId, grant.connectionId, manager))
        if (!held) return false
        await manager
            .createQueryBuilder(AgentConnectionEntity, "ac")
            .insert()
            .values({
                agentId: grant.agentId,
                connectionId: grant.connectionId,
                workspaceId: grant.workspaceId,
                purpose: grant.purpose,
                access: grant.access,
            })
            .orUpdate(["purpose", "access"], ["agent_id", "connection_id"])
            .execute()
        return true
    }
}
