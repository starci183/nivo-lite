import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentAccessLogService, BOUND } from "@modules/domain/agent-access-log"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import {
    ConnectionsError,
    ConnectionsErrorCode,
    ConnectionsService,
    type ConnectionActor,
    type ConnectionMember,
} from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { planExactly, purposeFor, type GrantChange } from "./connection-access.policy"
import type {
    AgentGrantWish,
    BindableAgent,
    ConnectionBoardEntry,
    ConnectionCandidate,
    ConnectionGrantEntry,
    ConnectionGrantWish,
} from "./connection-grants.contracts"
import { ConnectionGrantsError, ConnectionGrantsErrorCode } from "./errors/connection-grants.error"

const OWNER_ONLY = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
/** Most agents a workspace is asked about when the bindable ones of a provider are listed. */
const AGENT_LIMIT = 200
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const pairKey = (agentId: string, connectionId: string): string => `${agentId}:${connectionId}`

/** A non-secret fact, or null when the connection does not carry it. */
const publicFact = (meta: Readonly<Record<string, string>>, key: string): string | null => {
    const value = meta[key]
    if (value === undefined || value.trim() === "") return null
    return value
}

@Injectable()
/** Which agent is bound to which connection (owner only, both directions), through the primary EntityManager; rights live in attachments. */
export class ConnectionGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
        private readonly members: WorkspaceMembersService,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentDirectoryService,
        private readonly accessLog: AgentAccessLogService,
    ) {}

    /**
     * Every connection this agent is allowed to use, and whether it is bound to it already.
     * A disconnected connection cannot be granted, so it is left out. Any member may look.
     */
    async candidates(
        userId: string,
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<ConnectionCandidate>> {
        await this.members.require(userId, workspaceId)
        if (!RECORD_ID.test(agentId)) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: agentId } })
        }
        const [agent] = await this.agents.cardsOf(workspaceId, [agentId])
        if (agent === undefined) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: agentId } })
        }
        return this.candidatesOf(workspaceId, agentId, agent.module)
    }

    /**
     * The same list for a caller that has already proved who may look (a screen of the workbench door): no membership check, the agent
     * is named by its module. A disconnected connection is left out.
     */
    async candidatesOf(
        workspaceId: string,
        agentId: string,
        module: string,
    ): Promise<ReadonlyArray<ConnectionCandidate>> {
        const [listed, grants] = await Promise.all([
            this.connections.list(workspaceId),
            this.bindings.grantsOfAgent(workspaceId, agentId),
        ])
        const boundTo = new Set(grants.map((row) => row.connectionId))
        return listed.flatMap((connection) => {
            const purpose = purposeFor(module, connection.provider)
            if (purpose === null || connection.status === "disconnected") return []
            return [
                {
                    id: connection.id,
                    name: connection.name,
                    provider: connection.provider,
                    botUsername: publicFact(connection.meta, "bot_username"),
                    accountMasked: publicFact(connection.meta, "account_masked"),
                    status: connection.status,
                    purpose,
                    bound: boundTo.has(connection.id),
                },
            ]
        })
    }

    /**
     * The active agents of the workspace that may be bound to a connection of this provider, with what each would do there: the
     * answer the installation gives (`purposeFor`), asked before any connection exists. Any member may look.
     */
    async bindableAgents(
        userId: string,
        workspaceId: string,
        provider: string,
    ): Promise<ReadonlyArray<BindableAgent>> {
        await this.members.require(userId, workspaceId)
        const agents = await this.agents.activeModuleRefsOf(workspaceId, AGENT_LIMIT)
        return agents.flatMap((agent) => {
            const purpose = purposeFor(agent.module, provider)
            return purpose === null ? [] : [{ agentId: agent.id, purpose }]
        })
    }

    /** Every connection of the workspace with the agents bound to it (owner or manager). */
    async board(actor: ConnectionActor): Promise<ReadonlyArray<ConnectionBoardEntry>> {
        await this.connections.authorize(actor, MANAGER)
        const [connections, rows] = await Promise.all([
            this.connections.list(actor.workspaceId),
            this.bindings.grantsOfWorkspace(actor.workspaceId),
        ])
        const byConnection = new Map<string, Array<ConnectionGrantEntry>>()
        for (const row of rows) {
            byConnection.set(row.connectionId, [...(byConnection.get(row.connectionId) ?? []), { agentId: row.agentId }])
        }
        return connections.map((connection) => ({
            connection,
            botUsername: publicFact(connection.meta, "bot_username"),
            accountMasked: publicFact(connection.meta, "account_masked"),
            grants: byConnection.get(connection.id) ?? [],
        }))
    }

    /** Binds one agent to one connection, or removes the binding. Saved at once from either picker. */
    async setGrant(actor: ConnectionActor, connectionId: string, agentId: string, bound: boolean): Promise<void> {
        const member = await this.connections.authorize(actor, OWNER_ONLY)
        await this.entityManager.transaction((tx) => this.apply(actor, member, [{ agentId, connectionId, bound }], tx))
    }

    /** Exactly these agents are bound to this connection: an agent left out loses its binding. */
    async setConnectionAgents(
        actor: ConnectionActor,
        connectionId: string,
        wanted: ReadonlyArray<AgentGrantWish>,
    ): Promise<void> {
        const member = await this.connections.authorize(actor, OWNER_ONLY)
        await this.entityManager.transaction(async (tx) => {
            await this.connections.get(actor.workspaceId, connectionId, tx)
            const rows = await this.bindings.grantsOfConnection(actor.workspaceId, connectionId, tx)
            const plan = planExactly(
                new Set(rows.map((row) => row.agentId)),
                wanted.map((w) => w.agentId),
            )
            const changes = plan.map((p) => ({ agentId: p.id, connectionId, bound: p.bound }))
            await this.apply(actor, member, changes, tx)
        })
    }

    /** Exactly these connections are used by this agent: the same rules, the other way. */
    async setAgentConnections(
        actor: ConnectionActor,
        agentId: string,
        wanted: ReadonlyArray<ConnectionGrantWish>,
    ): Promise<void> {
        const member = await this.connections.authorize(actor, OWNER_ONLY)
        await this.entityManager.transaction(async (tx) => {
            const rows = await this.bindings.grantsOfAgent(actor.workspaceId, agentId, tx)
            const plan = planExactly(
                new Set(rows.map((row) => row.connectionId)),
                wanted.map((w) => w.connectionId),
            )
            const changes = plan.map((p) => ({ agentId, connectionId: p.id, bound: p.bound }))
            await this.apply(actor, member, changes, tx)
        })
    }

    /**
     * The one writer of bindings. Every pair is checked against the workspace and the module rules; a pair that cannot be
     * granted is refused with a reason. Each real change is written to agent_access_log (who, when, before, after) in the
     * same transaction.
     */
    private async apply(
        actor: ConnectionActor,
        member: ConnectionMember,
        changes: ReadonlyArray<GrantChange>,
        tx: EntityManager,
    ): Promise<void> {
        if (changes.length === 0) return
        const agentIds = [...new Set(changes.map((change) => change.agentId))]
        const connectionIds = [...new Set(changes.map((change) => change.connectionId))]
        const [agents, connections, current] = await Promise.all([
            this.agents.cardsOf(actor.workspaceId, agentIds),
            this.connections.findMany(actor.workspaceId, connectionIds, tx),
            this.bindings.grantsAmong(actor.workspaceId, agentIds, connectionIds, tx),
        ])
        const agentOf = new Map(agents.map((agent) => [agent.id, agent]))
        const connectionOf = new Map(connections.map((connection) => [connection.id, connection]))
        const before = new Set(current.map((row) => pairKey(row.agentId, row.connectionId)))
        await eachInOrder(changes, async (change) => {
            const agent = agentOf.get(change.agentId)
            const connection = connectionOf.get(change.connectionId)
            if (agent === undefined || connection === undefined) {
                throw new ConnectionsError({
                    code: ConnectionsErrorCode.NotFound,
                    params: { id: agent === undefined ? change.agentId : change.connectionId },
                })
            }
            const was = before.has(pairKey(agent.id, connection.id))
            if (was === change.bound) return
            if (!change.bound) {
                await this.bindings.removeGrant(
                    { workspaceId: actor.workspaceId, agentId: agent.id, connectionId: connection.id },
                    tx,
                )
            } else {
                const purpose = purposeFor(agent.module, connection.provider)
                if (purpose === null) {
                    throw new ConnectionGrantsError({
                        code: ConnectionGrantsErrorCode.PairRefused,
                        params: { agent: agent.name, connection: connection.name },
                    })
                }
                if (connection.status === "disconnected" && !was) {
                    throw new ConnectionGrantsError({
                        code: ConnectionGrantsErrorCode.ConnectionDisconnected,
                        params: { connection: connection.name },
                    })
                }
                await this.bindings.writeGrant(
                    {
                        workspaceId: actor.workspaceId,
                        agentId: agent.id,
                        connectionId: connection.id,
                        purpose,
                    },
                    tx,
                )
            }
            await this.accessLog.record(
                {
                    workspaceId: actor.workspaceId,
                    connectionId: connection.id,
                    agentId: agent.id,
                    connectionName: connection.name,
                    agentName: agent.name,
                    before: was ? BOUND : null,
                    after: change.bound ? BOUND : null,
                    changedBy: actor.principalId,
                    changedByName: member.displayName,
                },
                tx,
            )
        })
    }
}
