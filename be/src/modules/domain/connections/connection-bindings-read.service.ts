import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ConnectionBindingFacts, ConnectionState } from "./connection-bindings-read.contracts"
import { ConnectionEntity } from "./persistence/entities"

/** The text a provider reported in the public meta, trimmed; null when it is missing or blank. */
const reportedText = (meta: Readonly<Record<string, unknown>>, key: string): string | null => {
    const value = meta[key]
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
}

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
        return rows.map((row) => ({
            id: row.id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            createdAt: row.createdAt,
            botUsername: reportedText(row.publicMeta, "bot_username"),
            accountMasked: reportedText(row.publicMeta, "account_masked"),
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
    async workspaceOf(connectionId: string, manager: EntityManager): Promise<string | null> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true, workspaceId: true },
            where: { id: connectionId },
        })
        return row?.workspaceId ?? null
    }

    /** The name and environment of the connection; null when there is no such connection. */
    async stateOf(connectionId: string, manager: EntityManager): Promise<ConnectionState | null> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true, name: true, environment: true },
            where: { id: connectionId },
        })
        return row === null ? null : { name: row.name, environment: row.environment }
    }
}
