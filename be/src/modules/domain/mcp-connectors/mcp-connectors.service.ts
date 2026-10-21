import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CatalogApproval, CatalogSnapshot, HealthRecord, RemoteConnectorRecord } from "./mcp-connectors.contracts"
import type { McpConnectorKeyRow, McpConnectorRow } from "./persistence/mcp-connectors.rows"
import {
    APPROVE_CATALOG,
    LIST_CONNECTORS,
    RECORD_HEALTH,
    UPDATE_CATALOG,
    UPSERT_REMOTE_CONNECTOR,
} from "./persistence/mcp-connectors.sql"

@Injectable()
/** The connectors of a workspace's MCP gateway: the one reader and writer of public.mcp_connectors. */
export class McpConnectorsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The connector rows of a workspace, by key. */
    list(workspaceId: string): Promise<ReadonlyArray<McpConnectorRow>> {
        return this.entityManager.query<Array<McpConnectorRow>>(LIST_CONNECTORS, [workspaceId])
    }

    /** Registers a remote connector, or updates the one of that key; its catalog stays until the next read. */
    async upsertRemote(record: RemoteConnectorRecord): Promise<void> {
        await this.entityManager.query(UPSERT_REMOTE_CONNECTOR, [
            record.workspaceId,
            record.key,
            record.name,
            record.url,
            record.credentialRef,
            record.contractVersion,
            record.timeoutMs,
        ])
    }

    /** Stores a live catalog snapshot of a connector, the status the read left it in and the check time. */
    async storeCatalog(snapshot: CatalogSnapshot): Promise<void> {
        await this.entityManager.query(UPDATE_CATALOG, [
            snapshot.workspaceId,
            snapshot.key,
            snapshot.catalogJson,
            snapshot.catalogHash,
            snapshot.status,
        ])
    }

    /** Approves the live catalog of a remote connector; false when it changed since the approval was prepared (nothing written). */
    async approveCatalog(approval: CatalogApproval): Promise<boolean> {
        const rows = await this.entityManager.query<Array<McpConnectorKeyRow>>(APPROVE_CATALOG, [
            approval.workspaceId,
            approval.key,
            approval.approvedJson,
            approval.catalogHash,
            approval.approvedBy,
        ])
        return rows.length > 0
    }

    /** Records one health check of a connector; a disabled connector stays disabled. */
    async recordHealth(record: HealthRecord): Promise<void> {
        await this.entityManager.query(RECORD_HEALTH, [record.workspaceId, record.key, record.status])
    }
}
