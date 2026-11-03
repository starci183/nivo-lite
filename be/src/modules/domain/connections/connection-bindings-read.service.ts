import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ConnectionBindingFacts,
    FeedAccountFacts,
    ConnectionStatusFacts,
    OptionalConnectionState,
    OptionalConnectionWorkspace,
} from "./connection-bindings-read.contracts"
import { toConnectionRecord } from "./connections.mapper"
import type { OptionalConnectionRecord } from "./connections.contracts"
import { projectConnections } from "./persistence/connection.projection"
import type { ConnectionProjection } from "./persistence/connection.projection"
import { ConnectionEntity } from "./persistence/entities"

/** The text a provider reported in the public meta, trimmed; null when it is missing or blank. */
const reportedText = (meta: Readonly<Record<string, unknown>>, key: string): string | null => {
    const value = meta[key]
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
}

const bindingFactsOf = (row: ConnectionEntity): ConnectionBindingFacts => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
    botUsername: reportedText(row.publicMeta, "bot_username"),
    accountMasked: reportedText(row.publicMeta, "account_masked"),
})

@Injectable()
/** The connection reads the agent bindings need: the facts of the connections an agent is bound to, and whether a workspace holds one. */
export class ConnectionBindingsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The facts of the given connections, in no particular order, at most `limit`. */
    async factsOf(connectionIds: ReadonlyArray<string>, limit: number): Promise<Array<ConnectionBindingFacts>> {
        if (connectionIds.length === 0) return []
        const rows = await this.entityManager.find(ConnectionEntity, {
            select: { id: true, provider: true, name: true, status: true, createdAt: true, publicMeta: true },
            where: { id: In([...new Set(connectionIds)]) },
            take: limit,
        })
        return rows.map(bindingFactsOf)
    }

    /** One connection of the workspace as its record, for a read-only app that hands it to a provider port; null when there is none. */
    async recordOf(workspaceId: string, id: string): Promise<OptionalConnectionRecord> {
        const row = await projectConnections(this.entityManager.createQueryBuilder(ConnectionEntity, "c"))
            .where("c.workspaceId = :workspaceId AND c.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<ConnectionProjection>()
        return row === undefined ? null : toConnectionRecord(row)
    }

    /**
     * The live (not disconnected) feeds of a workspace under one provider, newest first, at most `limit`, with the account each
     * reported: what a read-only app reads the workspace's payment account from. It never logs the account.
     */
    async feedAccountsOf(workspaceId: string, provider: string, limit: number): Promise<Array<FeedAccountFacts>> {
        const rows = await this.entityManager.find(ConnectionEntity, {
            select: { id: true, provider: true, status: true, createdAt: true, publicMeta: true },
            where: { workspaceId, provider, status: Not("disconnected") },
            order: { createdAt: "DESC", id: "DESC" },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            provider: row.provider,
            status: row.status,
            createdAt: row.createdAt,
            accountNumber: reportedText(row.publicMeta, "account_number"),
            bankCode: reportedText(row.publicMeta, "bank_code"),
            accountHolder: reportedText(row.publicMeta, "account_holder"),
        }))
    }

    /** The connections of a workspace under one provider, oldest first, at most `limit`, with the status facts a status read shows. */
    async ofProvider(workspaceId: string, provider: string, limit: number): Promise<Array<ConnectionStatusFacts>> {
        const rows = await this.entityManager.find(ConnectionEntity, {
            select: {
                id: true,
                provider: true,
                name: true,
                status: true,
                createdAt: true,
                publicMeta: true,
                lastError: true,
            },
            where: { workspaceId, provider },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            ...bindingFactsOf(row),
            lastError: row.lastError,
            oaId: reportedText(row.publicMeta, "oa_id"),
            email: reportedText(row.publicMeta, "email"),
        }))
    }

    /** Whether the workspace holds the connection; the row is read with a shared lock so it stays until the transaction ends. */
    async holds(workspaceId: string, connectionId: string, manager: EntityManager): Promise<boolean> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true },
            where: { id: connectionId, workspaceId },
            lock: { mode: "pessimistic_read" },
        })
        return row !== null
    }

    /** The workspace that owns the connection; null when there is no such connection. */
    async workspaceOf(connectionId: string, manager: EntityManager): Promise<OptionalConnectionWorkspace> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true, workspaceId: true },
            where: { id: connectionId },
        })
        return row?.workspaceId ?? null
    }

    /** The name and environment of the connection; null when there is no such connection. */
    async stateOf(connectionId: string, manager: EntityManager): Promise<OptionalConnectionState> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true, name: true, environment: true },
            where: { id: connectionId },
        })
        return row === null ? null : { name: row.name, environment: row.environment }
    }
}
