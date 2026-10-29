import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentAccessLogService } from "@modules/domain/agent-access-log"
import { AgentBindingsService, AgentConnectionEntity } from "@modules/domain/agent-connections"
import type { Access } from "@modules/domain/agent-connections"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionMember } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentEntity } from "@modules/domain/agents"
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

/** The most rows one grant lookup answers. */
const GRANT_LIMIT = 500

/** The agent columns a grant check reads. */
interface AgentRow {
    /** The agent row id a grant is keyed by. */
    readonly id: string
    /** The display name shown next to the grant in the console. */
    readonly name: string
    /** The product module the agent serves, which bounds the connections it may be granted. */
    readonly module: string
}

/** The columns of a stored grant. */
interface GrantRow {
    /** The agent that holds the grant. */
    readonly agentId: string
    /** The connection the agent is allowed to use. */
    readonly connectionId: string
    /** The stored access level, parsed into an Access before use. */
    readonly access: string
}

/** True when a raw row is an object whose named fields are all text. */
const hasTextFields = (value: unknown, fields: ReadonlyArray<string>): boolean =>
    typeof value === "object" &&
    value !== null &&
    fields.every((field) => typeof Reflect.get(value, field) === "string")

const isAgentRow = (value: unknown): value is AgentRow => hasTextFields(value, ["id", "name", "module"])

const isGrantRow = (value: unknown): value is GrantRow => hasTextFields(value, ["agentId", "connectionId", "access"])

/** The agents of a workspace among the given ids. */
const findAgents = async (
    manager: EntityManager,
    workspaceId: string,
    agentIds: ReadonlyArray<string>,
): Promise<Array<AgentRow>> => {
    const rows: ReadonlyArray<unknown> = await manager
        .createQueryBuilder(AgentEntity, "a")
        .select("a.id", "id")
        .addSelect("a.name", "name")
        .addSelect("a.module", "module")
        .where("a.workspace_id = :workspaceId AND a.id IN (:...agentIds)", { workspaceId, agentIds })
        .limit(GRANT_LIMIT)
        .getRawMany()
    return rows.filter(isAgentRow)
}

/** The grants of a workspace matching the given condition (an agent, a connection, or the given agents and connections). */
const findGrants = async (
    manager: EntityManager,
    workspaceId: string,
    condition: string,
    parameters: Readonly<Record<string, unknown>>,
    ordered = false,
): Promise<Array<GrantRow>> => {
    const query = manager
        .createQueryBuilder(AgentConnectionEntity, "g")
        .select("g.agent_id", "agentId")
        .addSelect("g.connection_id", "connectionId")
        .addSelect("g.access", "access")
        .where(`g.workspace_id = :workspaceId${condition}`, { workspaceId, ...parameters })
    const rows: ReadonlyArray<unknown> = await (ordered ? query.orderBy("g.created_at") : query)
        .limit(GRANT_LIMIT)
        .getRawMany()
    return rows.filter(isGrantRow)
}

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
        const [agent] = await findAgents(this.entityManager, workspaceId, [agentId])
        if (agent === undefined) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: agentId } })
        }
        const [listed, grants] = await Promise.all([
            this.connections.list(workspaceId),
            findGrants(this.entityManager, workspaceId, " AND g.agent_id = :agentId", { agentId }),
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
            findGrants(this.entityManager, actor.workspaceId, "", {}, true),
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
            const rows = await findGrants(tx, actor.workspaceId, " AND g.connection_id = :connectionId", {
                connectionId,
            })
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
            const rows = await findGrants(tx, actor.workspaceId, " AND g.agent_id = :agentId", { agentId })
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
            findAgents(tx, actor.workspaceId, agentIds),
            this.connections.findMany(actor.workspaceId, connectionIds, tx),
            findGrants(
                tx,
                actor.workspaceId,
                " AND g.agent_id IN (:...agentIds) AND g.connection_id IN (:...connectionIds)",
                { agentIds, connectionIds },
            ),
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
