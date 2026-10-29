import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentAccessLogService } from "@modules/domain/agent-access-log"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { Access } from "@modules/domain/agent-connections"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionMember } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { isAccess, normaliseAccess, planExactly, purposeFor } from "./connection-access.policy"
import type { GrantChange, RequestedGrant } from "./connection-access.policy"
import type {
    AgentGrantWish,
    ConnectionBoardEntry,
    ConnectionCandidate,
    ConnectionGrantEntry,
    ConnectionGrantWish,
} from "./connection-grants.contracts"
import { ConnectionGrantsError, ConnectionGrantsErrorCode } from "./errors/connection-grants.error"

const OWNER_ONLY = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const pairKey = (agentId: string, connectionId: string): string => `${agentId}:${connectionId}`

/** A stored access word, or auto when the row holds something else. */
const storedLevel = (value: string): Access => (isAccess(value) ? value : "auto")

/** A non-secret fact, or null when the connection does not carry it. */
const publicFact = (meta: Readonly<Record<string, string>>, key: string): string | null => {
    const value = meta[key]
    if (value === undefined || value.trim() === "") return null
    return value
}

@Injectable()
/** Which agent uses which connection, and how far (owner only, both directions), reached through the primary EntityManager. */
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
     * Every connection this agent is allowed to use, with the access it already has (null when it has none).
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
        const [listed, grants] = await Promise.all([
            this.connections.list(workspaceId),
            this.bindings.grantsOfAgent(workspaceId, agentId),
        ])
        const accessOf = new Map(grants.map((row) => [row.connectionId, storedLevel(row.access)]))
        return listed.flatMap((connection) => {
            const purpose = purposeFor(agent.module, connection.provider)
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
                    access: accessOf.get(connection.id) ?? null,
                },
            ]
        })
    }

    /** Every connection of the workspace with the agents that use it and how far (owner or manager). */
    async board(actor: ConnectionActor): Promise<ReadonlyArray<ConnectionBoardEntry>> {
        await this.connections.authorize(actor, MANAGER)
        const [connections, rows] = await Promise.all([
            this.connections.list(actor.workspaceId),
            this.bindings.grantsOfWorkspace(actor.workspaceId),
        ])
        const byConnection = new Map<string, Array<ConnectionGrantEntry>>()
        for (const row of rows) {
            const access = isAccess(row.access) ? row.access : "auto"
            byConnection.set(row.connectionId, [
                ...(byConnection.get(row.connectionId) ?? []),
                { agentId: row.agentId, access },
            ])
        }
        return connections.map((connection) => ({
            connection,
            botUsername: publicFact(connection.meta, "bot_username"),
            accountMasked: publicFact(connection.meta, "account_masked"),
            grants: byConnection.get(connection.id) ?? [],
        }))
    }

    /** One agent access to one connection (null removes it). Saved at once from either picker. */
    async setGrant(
        actor: ConnectionActor,
        connectionId: string,
        agentId: string,
        access: RequestedGrant,
    ): Promise<void> {
        const member = await this.connections.authorize(actor, OWNER_ONLY)
        await this.entityManager.transaction((tx) =>
            this.apply(actor, member, [{ agentId, connectionId, access: normaliseAccess(access) }], tx),
        )
    }

    /** Exactly these agents use this connection: a bare agent keeps its level, an agent left out loses its access to it. */
    async setConnectionAgents(
        actor: ConnectionActor,
        connectionId: string,
        wanted: ReadonlyArray<AgentGrantWish>,
    ): Promise<void> {
        const member = await this.connections.authorize(actor, OWNER_ONLY)
        await this.entityManager.transaction(async (tx) => {
            await this.connections.get(actor.workspaceId, connectionId, tx)
            const rows = await this.bindings.grantsOfConnection(actor.workspaceId, connectionId, tx)
            const have = new Map(rows.map((row) => [row.agentId, storedLevel(row.access)]))
            const plan = planExactly(
                have,
                wanted.map((w) => ({ id: w.agentId, access: w.access })),
            )
            const changes = plan.map((p) => ({ agentId: p.id, connectionId, access: p.access }))
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
            const have = new Map(rows.map((row) => [row.connectionId, storedLevel(row.access)]))
            const plan = planExactly(
                have,
                wanted.map((w) => ({ id: w.connectionId, access: w.access })),
            )
            const changes = plan.map((p) => ({ agentId, connectionId: p.id, access: p.access }))
            await this.apply(actor, member, changes, tx)
        })
    }

    /**
     * The one writer of agent access. Every pair is checked against the workspace and the module rules; a pair that cannot be
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
        const before = new Map(current.map((row) => [pairKey(row.agentId, row.connectionId), row.access]))
        await eachInOrder(changes, async (change) => {
            const agent = agentOf.get(change.agentId)
            const connection = connectionOf.get(change.connectionId)
            if (agent === undefined || connection === undefined) {
                throw new ConnectionsError({
                    code: ConnectionsErrorCode.NotFound,
                    params: { id: agent === undefined ? change.agentId : change.connectionId },
                })
            }
            const was = before.get(pairKey(agent.id, connection.id)) ?? null
            if (was === change.access) return
            if (change.access === null) {
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
                if (connection.status === "disconnected" && was === null) {
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
                        access: change.access,
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
                    before: was,
                    after: change.access,
                    changedBy: actor.principalId,
                    changedByName: member.displayName,
                },
                tx,
            )
        })
    }
}
