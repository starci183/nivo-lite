import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentEntity } from "@modules/domain/agents/persistence/entities"
import { ConnectionEntity } from "@modules/domain/connections/persistence/entities"
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

/** A binding joined to its agent, as the driver answers it: the creation moment is still a date. */
interface AgentBindingRaw extends Omit<BoundAgentFacts, "created_at"> {
    readonly created_at: Date
}

/** A binding joined to its connection, as the driver answers it. */
interface ConnectionBindingRaw extends Omit<BoundConnectionFacts, "created_at"> {
    readonly created_at: Date
}

const agentFactsOf = (row: AgentBindingRaw): BoundAgentFacts => ({ ...row, created_at: row.created_at.toISOString() })

const connectionFactsOf = (row: ConnectionBindingRaw): BoundConnectionFacts => ({
    ...row,
    created_at: row.created_at.toISOString(),
})

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
    ) {}

    /** The active agents bound to a connection for the purpose(s), oldest first. */
    async agentsFor(
        connectionId: string,
        purpose: PurposeSelector,
        options: AgentsForOptions = {},
    ): Promise<ReadonlyArray<BoundAgent>> {
        const rows = await this.entityManager
            .createQueryBuilder(AgentConnectionEntity, "ac")
            .select("a.id", "id")
            .addSelect("a.module", "module")
            .addSelect("a.name", "name")
            .addSelect("a.created_at", "created_at")
            .addSelect("ac.access", "access")
            .addSelect("ac.purpose", "purpose")
            .innerJoin(AgentEntity, "a", "a.id = ac.agent_id")
            .where("ac.connection_id = :connectionId AND ac.purpose = ANY(:purposes) AND a.status = 'active'", {
                connectionId,
                purposes: purposesOf(purpose),
            })
            .orderBy("a.created_at", "ASC")
            .addOrderBy("a.id", "ASC")
            .limit(BINDINGS_MAX)
            .getRawMany<AgentBindingRaw>()
        return boundAgentsOf(rows.map(agentFactsOf), options)
    }

    /** The connections an agent is bound to for the purpose(s), oldest first; disconnected ones never count. */
    async connectionsFor(
        agentId: string,
        purpose: PurposeSelector,
        options: ConnectionsForOptions = {},
    ): Promise<ReadonlyArray<BoundConnection>> {
        const rows = await this.connectionRows(
            this.entityManager
                .createQueryBuilder(AgentConnectionEntity, "ac")
                .where("ac.agent_id = :agentId AND ac.purpose = ANY(:purposes)", {
                    agentId,
                    purposes: purposesOf(purpose),
                }),
        )
        return boundConnectionsOf(rows, options)
    }

    /** Every connection granted to an agent of the caller workspace, whatever the purpose; any member may look. */
    async connectionsOfAgent(
        userId: string,
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<BoundConnection>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.connectionRows(
            this.entityManager
                .createQueryBuilder(AgentConnectionEntity, "ac")
                .where("ac.agent_id = :agentId AND ac.workspace_id = :workspaceId AND ac.purpose = ANY(:purposes)", {
                    agentId,
                    workspaceId,
                    purposes: PURPOSES,
                }),
        )
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

    /** The bindings selected by `bindings` joined to their connections, oldest connection first. */
    private async connectionRows(
        bindings: SelectQueryBuilder<AgentConnectionEntity>,
    ): Promise<Array<BoundConnectionFacts>> {
        const rows = await bindings
            .select("c.id", "id")
            .addSelect("c.provider", "provider")
            .addSelect("c.name", "name")
            .addSelect("c.status", "status")
            .addSelect("c.created_at", "created_at")
            .addSelect("ac.access", "access")
            .addSelect("ac.purpose", "purpose")
            .addSelect("NULLIF(btrim(c.public_meta ->> 'bot_username'), '')", "bot_username")
            .addSelect("NULLIF(btrim(c.public_meta ->> 'account_masked'), '')", "account_masked")
            .innerJoin(ConnectionEntity, "c", "c.id = ac.connection_id")
            .orderBy("c.created_at", "ASC")
            .addOrderBy("c.id", "ASC")
            .limit(BINDINGS_MAX)
            .getRawMany<ConnectionBindingRaw>()
        return rows.map(connectionFactsOf)
    }

    /**
     * Grants (or changes the grant of) a connection to an agent of the same workspace; answers false when either is not in the
     * workspace. Both rows are held while the grant is written, so neither can leave the workspace in between.
     */
    private async upsert(manager: EntityManager, grant: BindingGrant): Promise<boolean> {
        const held = await manager
            .createQueryBuilder(AgentEntity, "a")
            .select("a.id", "id")
            .innerJoin(ConnectionEntity, "c", "c.workspace_id = a.workspace_id")
            .where("a.id = :agentId AND c.id = :connectionId AND a.workspace_id = :workspaceId", {
                agentId: grant.agentId,
                connectionId: grant.connectionId,
                workspaceId: grant.workspaceId,
            })
            .limit(1)
            .setLock("pessimistic_read")
            .getRawOne<{ id: string }>()
        if (held === undefined) return false
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
