import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { credentialStateOf } from "./credential-state.policy"
import type {
    CatalogApproval,
    CatalogSnapshot,
    HealthRecord,
    RemoteConnectorRecord,
    SealedCredentialRecord,
    OptionalSealedCredential,
    OptionalStoredConnectorCredential,
} from "./mcp-connectors.contracts"
import type { McpConnectorKeyRow, McpConnectorRow, McpSealedCredentialRow } from "./persistence/mcp-connectors.rows"
import {
    APPROVE_CATALOG,
    FIND_SEALED_CREDENTIAL,
    LIST_CONNECTORS,
    RECORD_HEALTH,
    SAMPLE_SEALED_CREDENTIAL,
    SET_CREDENTIAL,
    UPDATE_CATALOG,
    UPSERT_REMOTE_CONNECTOR,
} from "./persistence/mcp-connectors.sql"

@Injectable()
/**
 * The connectors of a workspace's MCP gateway: the one reader and writer of public.mcp_connectors. A remote connector's credential
 * arrives here already sealed (the connection-secrets cipher) and leaves sealed; this capability never sees the plain value, and
 * its list read never selects the sealed text.
 */
export class McpConnectorsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The connector rows of a workspace, by key. */
    list(workspaceId: string): Promise<ReadonlyArray<McpConnectorRow>> {
        return this.entityManager.query<Array<McpConnectorRow>>(LIST_CONNECTORS, [workspaceId])
    }

    /** Registers a remote connector, or updates the one of that key; its catalog and its stored credential stay. */
    async upsertRemote(record: RemoteConnectorRecord): Promise<void> {
        await this.entityManager.query(UPSERT_REMOTE_CONNECTOR, [
            record.workspaceId,
            record.key,
            record.name,
            record.url,
            record.needsCredential,
            record.contractVersion,
            record.timeoutMs,
        ])
    }

    /** Stores the sealed credential of a remote connector, replacing the one it had; false when there is no such remote connector. */
    async setCredential(record: SealedCredentialRecord): Promise<boolean> {
        const rows = await this.entityManager.query<Array<McpConnectorKeyRow>>(SET_CREDENTIAL, [
            record.workspaceId,
            record.key,
            record.sealed,
            record.setBy,
        ])
        return rows.length > 0
    }

    /** The stored credential of a remote connector (its state and sealed text), or null when there is no such remote connector. */
    async storedCredential(workspaceId: string, key: string): Promise<OptionalStoredConnectorCredential> {
        const [row] = await this.entityManager.query<Array<McpSealedCredentialRow>>(FIND_SEALED_CREDENTIAL, [
            workspaceId,
            key,
        ])
        return row === undefined
            ? null
            : { state: credentialStateOf(row.credential_state), sealed: row.credential_sealed }
    }

    /** One sealed credential of any workspace, or null when none is sealed: the boot proof that the connection key opens it. */
    async sealedSample(): Promise<OptionalSealedCredential> {
        const [row] = await this.entityManager.query<Array<McpSealedCredentialRow>>(SAMPLE_SEALED_CREDENTIAL)
        return row?.credential_sealed ?? null
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
