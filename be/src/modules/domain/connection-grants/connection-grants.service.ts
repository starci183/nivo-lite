import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionMember } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isAccess, normaliseAccess, planExactly, purposeFor } from "./connection-access.policy"
import type { Access, GrantChange } from "./connection-access.policy"
import type {
    AgentGrantWish,
    ConnectionBoardEntry,
    ConnectionGrantEntry,
    ConnectionGrantWish,
} from "./connection-grants.contracts"
import { ConnectionGrantsError, ConnectionGrantsErrorCode } from "./errors/connection-grants.error"
import type { AgentRow, GrantRow } from "./persistence/connection-grants.rows"
import {
    DELETE_GRANT,
    FIND_AGENT_GRANTS,
    FIND_AGENTS,
    FIND_CONNECTION_GRANTS,
    FIND_GRANTS,
    LIST_WORKSPACE_GRANTS,
    INSERT_ACCESS_LOG,
    UPSERT_GRANT,
} from "./persistence/connection-grants.sql"

const OWNER_ONLY = ["owner"] as const
const MANAGER = ["owner", "manager"] as const

const pairKey = (agentId: string, connectionId: string): string => `${agentId}:${connectionId}`

@Injectable()
/** Which agent uses which connection, and how far (owner only, both directions), reached through the primary EntityManager. */
export class ConnectionGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
    ) {}

    /** Every connection of the workspace with the agents that use it and how far (owner or manager). */
    async board(actor: ConnectionActor): Promise<ReadonlyArray<ConnectionBoardEntry>> {
        await this.connections.authorize(actor, MANAGER)
        const [connections, rows] = await Promise.all([
            this.connections.list(actor.workspaceId),
            this.entityManager.query<Array<GrantRow>>(LIST_WORKSPACE_GRANTS, [actor.workspaceId]),
        ])
        const byConnection = new Map<string, Array<ConnectionGrantEntry>>()
        for (const row of rows) {
            const access = isAccess(row.access) ? row.access : "auto"
            byConnection.set(row.connection_id, [
                ...(byConnection.get(row.connection_id) ?? []),
                { agentId: row.agent_id, access },
            ])
        }
        return connections.map((connection) => ({ connection, grants: byConnection.get(connection.id) ?? [] }))
    }

    /** One agent access to one connection (null removes it). Saved at once from either picker. */
    async setGrant(
        actor: ConnectionActor,
        connectionId: string,
        agentId: string,
        access: Access | null,
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
            const rows = await tx.query<Array<GrantRow>>(FIND_CONNECTION_GRANTS, [actor.workspaceId, connectionId])
            const have = new Map(rows.map((row) => [row.agent_id, row.access as Access]))
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
            const rows = await tx.query<Array<GrantRow>>(FIND_AGENT_GRANTS, [actor.workspaceId, agentId])
            const have = new Map(rows.map((row) => [row.connection_id, row.access as Access]))
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
            tx.query<Array<AgentRow>>(FIND_AGENTS, [actor.workspaceId, agentIds]),
            this.connections.findMany(actor.workspaceId, connectionIds, tx),
            tx.query<Array<GrantRow>>(FIND_GRANTS, [actor.workspaceId, agentIds, connectionIds]),
        ])
        const agentOf = new Map(agents.map((agent) => [agent.id, agent]))
        const connectionOf = new Map(connections.map((connection) => [connection.id, connection]))
        const before = new Map(current.map((row) => [pairKey(row.agent_id, row.connection_id), row.access]))
        for (const change of changes) {
            const agent = agentOf.get(change.agentId)
            const connection = connectionOf.get(change.connectionId)
            if (agent === undefined || connection === undefined) {
                throw new ConnectionsError({
                    code: ConnectionsErrorCode.NotFound,
                    params: { id: agent === undefined ? change.agentId : change.connectionId },
                })
            }
            const was = before.get(pairKey(agent.id, connection.id)) ?? null
            if (was === change.access) continue
            if (change.access === null) {
                await tx.query(DELETE_GRANT, [actor.workspaceId, agent.id, connection.id])
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
                await tx.query(UPSERT_GRANT, [agent.id, connection.id, actor.workspaceId, purpose, change.access])
            }
            await tx.query(INSERT_ACCESS_LOG, [
                actor.workspaceId,
                connection.id,
                agent.id,
                connection.name,
                agent.name,
                was,
                change.access,
                actor.principalId,
                member.displayName,
            ])
        }
    }
}
