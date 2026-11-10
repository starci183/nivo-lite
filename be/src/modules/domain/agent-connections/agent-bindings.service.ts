import { Injectable, Optional } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectBindingAgents, InjectBindingManagers } from "./agent-connections.decorators"
import type { BindingAgentsDirectory, BindingManagers } from "./agent-connections.port"
import {
    INBOUND_MODULES,
    PURPOSES,
    boundAgentsOf,
    boundConnectionsOf,
    exceedsManagerCeiling,
    isAccess,
    isPurpose,
    handoversFrom,
    purposesOf,
    splitRoute,
} from "./agent-bindings.policy"
import type {
    AgentGrant,
    ConnectionGrant,
    AgentsForOptions,
    BindingGrant,
    BindingTarget,
    BoundAgent,
    BoundAgentFacts,
    BoundConnection,
    BoundConnectionFacts,
    ConnectionsForOptions,
    InboundRoute,
    LinkedFacts,
    ModuleRef,
    OptionalConnectionId,
    OptionalResumeKeep,
    PurposeSelector,
    ResumeConflict,
    ResumingAgent,
    StoredGrant,
} from "./agent-connections.contracts"
import { AgentConnectionsError, AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"
import { ChannelOwnersService } from "./channel-owners.service"

/** Who may change which agent uses which connection. */
const GOVERNORS = ["owner", "manager"] as const

/** The most bindings one read answers. */
const BINDINGS_MAX = 200

/** The most grants one grant read answers. */
const GRANTS_MAX = 500

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
        @InjectBindingAgents() private readonly agents: BindingAgentsDirectory,
        private readonly connections: ConnectionBindingsReadService,
        private readonly owners: ChannelOwnersService,
        @Optional() @InjectBindingManagers() private readonly managers?: BindingManagers,
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

    /**
     * Every connection granted to each of the given agents of the caller workspace, whatever the purpose, in two reads whatever the
     * number of agents; one entry per grant, agents in the order given, each agent's grants oldest connection first. Any member may look.
     */
    async connectionsOfAgents(
        userId: string,
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<AgentGrant>> {
        await this.members.require(userId, workspaceId)
        if (agentIds.length === 0) return []
        const links = await this.entityManager.find(AgentConnectionEntity, {
            where: { workspaceId, agentId: In([...agentIds]), purpose: In([...PURPOSES]) },
            take: GRANTS_MAX,
        })
        const rows = await this.rowsOfLinks(links)
        return agentIds.flatMap((agentId) =>
            boundConnectionsOf(
                rows.filter((row) => row.agentId === agentId).map((row) => row.facts),
                {},
            ).map((connection): AgentGrant => ({ agentId, connection })),
        )
    }

    /**
     * Every grant of the workspace beside the active agent that holds it, for the reverse view of a connection ("which agents use
     * this"); one entry per grant, oldest grant first, in two reads whatever the number of connections. A grant of an agent that is
     * not active is left out. Any member may look.
     */
    async grantsWithAgents(userId: string, workspaceId: string): Promise<ReadonlyArray<ConnectionGrant>> {
        await this.members.require(userId, workspaceId)
        const links = await this.entityManager.find(AgentConnectionEntity, {
            where: { workspaceId, purpose: In([...PURPOSES]) },
            order: { createdAt: "ASC" },
            take: GRANTS_MAX,
        })
        if (links.length === 0) return []
        const agents = await this.agents.activeCreatedAmong(
            workspaceId,
            [...new Set(links.map((link) => link.agentId))],
            BINDINGS_MAX,
        )
        return links.flatMap((link) => {
            const agent = agents.find((entry) => entry.id === link.agentId)
            if (agent === undefined || !isPurpose(link.purpose)) return []
            return [
                {
                    connectionId: link.connectionId,
                    agentId: agent.id,
                    agentName: agent.name,
                    module: agent.module,
                    purpose: link.purpose,
                    access: isAccess(link.access) ? link.access : "read",
                },
            ]
        })
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
        const caller = await this.members.require(userId, grant.workspaceId, GOVERNORS)
        const byManager = caller.role !== "owner"
        if (byManager) await this.requireManaged(userId, grant.workspaceId, grant.agentId)
        const granted = await this.entityManager.transaction((manager) => this.upsert(manager, grant, byManager))
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

    /**
     * The channels a paused agent answers that another agent of its role answers now; empty when resuming it leaves each channel with
     * one agent. Names come with the connection so the owner can be asked whom to keep.
     */
    async resumeConflictsOf(
        workspaceId: string,
        agentId: string,
        module: string,
    ): Promise<ReadonlyArray<ResumeConflict>> {
        const found = await this.owners.conflictsOfAgent(workspaceId, agentId, module)
        if (found.length === 0) return []
        const facts = await this.connections.factsOf(
            found.map((entry) => entry.connectionId),
            BINDINGS_MAX,
        )
        return found.map((entry) => ({
            connectionId: entry.connectionId,
            connectionName: facts.find((fact) => fact.id === entry.connectionId)?.name ?? entry.connectionId,
            owner: entry.owner,
        }))
    }

    /**
     * Refuses a resume that would give a channel two agents of one role, naming the channels and who answers them, unless the caller
     * chose whom to keep. Returns the conflicts to settle once the agent is active (none when there are none).
     */
    async requireResumeChoice(
        workspaceId: string,
        agent: ResumingAgent,
        keep: OptionalResumeKeep,
    ): Promise<ReadonlyArray<ResumeConflict>> {
        const conflicts = await this.resumeConflictsOf(workspaceId, agent.id, agent.module)
        if (conflicts.length === 0 || keep !== null) return conflicts
        throw new AgentConnectionsError({
            code: AgentConnectionsErrorCode.ResumeConflict,
            params: {
                agent: agent.name,
                agentId: agent.id,
                channels: conflicts.map((conflict) => conflict.connectionName).join(", "),
                connectionIds: conflicts.map((conflict) => conflict.connectionId).join(","),
                owners: [...new Set(conflicts.map((conflict) => conflict.owner.agentName))].join(", "),
            },
        })
    }

    /**
     * Settles the conflicts of a resume once the agent is active: "resumed" takes the channels from the agents that answer them now,
     * "current" leaves them there and drops the resumed agent's grants on those channels. Each channel ends with one agent.
     */
    async settleResume(
        workspaceId: string,
        agentId: string,
        conflicts: ReadonlyArray<ResumeConflict>,
        keep: OptionalResumeKeep,
    ): Promise<void> {
        if (keep === null || conflicts.length === 0) return
        await this.entityManager.transaction((manager) =>
            eachInOrder(conflicts, (conflict) => {
                const loser = keep === "resumed" ? conflict.owner.agentId : agentId
                return this.removeGrant({ workspaceId, agentId: loser, connectionId: conflict.connectionId }, manager)
            }),
        )
    }

    /** The ids of the agents that use a connection of the workspace, in the order they were attached, at most `limit`. */
    async agentIdsOf(workspaceId: string, connectionId: string, limit: number): Promise<ReadonlyArray<string>> {
        const links = await this.entityManager.find(AgentConnectionEntity, {
            select: { agentId: true },
            where: { workspaceId, connectionId },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return links.map((link) => link.agentId)
    }

    /** The grants of the workspace matching the condition, with the manager of the caller (its transaction), oldest first. */
    private async grantsWhere(
        where: FindOptionsWhere<AgentConnectionEntity>,
        manager: EntityManager,
    ): Promise<Array<StoredGrant>> {
        const links = await manager.find(AgentConnectionEntity, {
            select: { agentId: true, connectionId: true, access: true },
            where,
            order: { createdAt: "ASC" },
            take: GRANTS_MAX,
        })
        return links.map((link) => ({ agentId: link.agentId, connectionId: link.connectionId, access: link.access }))
    }

    /** Every grant of the workspace, oldest first. */
    grantsOfWorkspace(workspaceId: string, manager: EntityManager = this.entityManager): Promise<Array<StoredGrant>> {
        return this.grantsWhere({ workspaceId }, manager)
    }

    /** The grants an agent of the workspace holds. */
    grantsOfAgent(
        workspaceId: string,
        agentId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<StoredGrant>> {
        return this.grantsWhere({ workspaceId, agentId }, manager)
    }

    /** The grants of one connection of the workspace. */
    grantsOfConnection(
        workspaceId: string,
        connectionId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<StoredGrant>> {
        return this.grantsWhere({ workspaceId, connectionId }, manager)
    }

    /** The grants among the given agents and connections of the workspace. */
    grantsAmong(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        connectionIds: ReadonlyArray<string>,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<StoredGrant>> {
        return this.grantsWhere(
            { workspaceId, agentId: In([...agentIds]), connectionId: In([...connectionIds]) },
            manager,
        )
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
        const caller = await this.members.require(userId, target.workspaceId, GOVERNORS)
        if (caller.role !== "owner") await this.requireManaged(userId, target.workspaceId, target.agentId)
        await this.removeGrant(target)
    }

    /** The bindings matching `where` beside the facts of their connections, oldest connection first. */
    private async connectionRows(where: FindOptionsWhere<AgentConnectionEntity>): Promise<Array<BoundConnectionFacts>> {
        const links = await this.entityManager.find(AgentConnectionEntity, { where, take: BINDINGS_MAX })
        return (await this.rowsOfLinks(links)).map((row) => row.facts)
    }

    /** The links beside the facts of their connections, oldest connection first; each row keeps the agent of its link. */
    private async rowsOfLinks(links: ReadonlyArray<AgentConnectionEntity>): Promise<Array<LinkedFacts>> {
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
                    .map((link): LinkedFacts => ({
                        agentId: link.agentId,
                        facts: {
                            id: connection.id,
                            provider: connection.provider,
                            name: connection.name,
                            status: connection.status,
                            created_at: connection.createdAt.toISOString(),
                            access: link.access,
                            purpose: link.purpose,
                            bot_username: connection.botUsername,
                            account_masked: connection.accountMasked,
                        },
                    })),
            )
    }

    /** Refuses a manager acting on an agent outside the rooms and roles it is open to; without the scope port only the owner may act. */
    private async requireManaged(userId: string, workspaceId: string, agentId: string): Promise<void> {
        if (this.managers !== undefined && (await this.managers.canManage(workspaceId, userId, agentId))) return
        throw new AgentConnectionsError({ code: AgentConnectionsErrorCode.OutOfScope, params: { agentId } })
    }

    /** Refuses a manager's grant that raises the access above what the owner allows: asking first, or the level the grant already has. */
    private async requireWithinCeiling(manager: EntityManager, grant: BindingGrant): Promise<void> {
        const existing = await manager.findOne(AgentConnectionEntity, {
            select: { access: true },
            where: { agentId: grant.agentId, connectionId: grant.connectionId },
        })
        if (!exceedsManagerCeiling(grant.access, existing?.access ?? null)) return
        throw new AgentConnectionsError({
            code: AgentConnectionsErrorCode.AccessAboveCeiling,
            params: { agentId: grant.agentId, access: grant.access },
        })
    }

    /**
     * Refuses a grant that would give a role a second agent answering the same channel connection (one role, many agents: each
     * channel is answered by exactly one agent of a role). A grant that only reads, or of a purpose that is no channel, passes.
     */
    private async requireChannelFree(manager: EntityManager, grant: BindingGrant): Promise<void> {
        const [agent] = await this.agents.activeCreatedAmong(grant.workspaceId, [grant.agentId], 1)
        if (agent === undefined) return
        await this.owners.requireFree(
            grant.workspaceId,
            grant.connectionId,
            { agentId: grant.agentId, module: agent.module, purpose: grant.purpose, access: grant.access },
            manager,
        )
    }

    /**
     * Grants (or changes the grant of) a connection to an agent of the same workspace; answers false when either is not in the
     * workspace. Both rows are held while the grant is written, so neither can leave the workspace in between.
     */
    private async upsert(manager: EntityManager, grant: BindingGrant, byManager = false): Promise<boolean> {
        const held =
            (await this.agents.holds(grant.workspaceId, grant.agentId, manager)) &&
            (await this.connections.holds(grant.workspaceId, grant.connectionId, manager))
        if (!held) return false
        if (byManager) await this.requireWithinCeiling(manager, grant)
        await this.requireChannelFree(manager, grant)
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
