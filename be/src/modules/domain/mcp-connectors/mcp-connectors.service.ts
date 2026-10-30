import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { credentialStateOf } from "./credential-state.policy"
import type {
    CatalogApproval,
    CatalogSnapshot,
    HealthRecord,
    McpConnectorRow,
    RemoteConnectorRecord,
    SealedCredentialRecord,
    OptionalSealedCredential,
    OptionalStoredConnectorCredential,
} from "./mcp-connectors.contracts"
import { McpConnectorEntity } from "./persistence/entities"

/** The most connectors one workspace list answers. */
const CONNECTOR_LIMIT = 200

/** Reads the JSON text of a catalog into the jsonb column, so the database judges the text exactly as it always did. */
const CATALOG_JSON = () => "CAST(:catalogJson AS jsonb)"

/** Reads the JSON text of an approval into the jsonb column. */
const APPROVED_JSON = () => "CAST(:approvedJson AS jsonb)"

/** The database's own clock for a time column. */
const NOW = () => "now()"

/** True when a write answered at least one row. */
const answeredRows = (raw: unknown): boolean => Array.isArray(raw) && raw.length > 0

@Injectable()
/**
 * The connectors of a workspace's MCP gateway: the one reader and writer of public.mcp_connectors. A remote connector's credential
 * arrives here already sealed (the connection-secrets cipher) and leaves sealed; this capability never sees the plain value, and
 * its list read never selects the sealed text.
 */
export class McpConnectorsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The connector rows of a workspace, by key; the times are selected as the ISO text the gateway always read. */
    list(workspaceId: string): Promise<ReadonlyArray<McpConnectorRow>> {
        return this.entityManager
            .createQueryBuilder(McpConnectorEntity, "c")
            .select("c.key", "key")
            .addSelect("c.name", "name")
            .addSelect("c.kind", "kind")
            .addSelect("c.url", "url")
            .addSelect("c.credentialState", "credential_state")
            .addSelect("to_json(c.credential_set_at) #>> '{}'", "credential_set_at")
            .addSelect("c.status", "status")
            .addSelect("c.contractVersion", "contract_version")
            .addSelect("c.timeoutMs", "timeout_ms")
            .addSelect("c.toolCatalog", "tool_catalog")
            .addSelect("c.catalogHash", "catalog_hash")
            .addSelect("c.approvedCatalog", "approved_catalog")
            .addSelect("to_json(c.approved_at) #>> '{}'", "approved_at")
            .addSelect("to_json(c.checked_at) #>> '{}'", "checked_at")
            .where("c.workspaceId = :workspaceId", { workspaceId })
            .orderBy("c.key", "ASC")
            .limit(CONNECTOR_LIMIT)
            .getRawMany<McpConnectorRow>()
    }

    /** Registers a remote connector, or updates the one of that key; its catalog and its stored credential stay. */
    upsertRemote(record: RemoteConnectorRecord): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            await manager
                .createQueryBuilder(McpConnectorEntity, "mc")
                .insert()
                .values({
                    workspaceId: record.workspaceId,
                    key: record.key,
                    name: record.name,
                    kind: "remote",
                    url: record.url,
                    credentialState: record.needsCredential ? "needed" : "none",
                    contractVersion: record.contractVersion,
                    timeoutMs: record.timeoutMs,
                })
                .orUpdate(["name", "url", "contract_version", "timeout_ms"], ["workspace_id", "key"])
                .execute()
            if (record.needsCredential) {
                await manager.update(
                    McpConnectorEntity,
                    { workspaceId: record.workspaceId, key: record.key, credentialState: "none" },
                    { credentialState: "needed" },
                )
            }
        })
    }

    /** Stores the sealed credential of a remote connector, replacing the one it had; false when there is no such remote connector. */
    async setCredential(record: SealedCredentialRecord): Promise<boolean> {
        const written = await this.entityManager
            .createQueryBuilder(McpConnectorEntity, "mc")
            .update()
            .set({
                credentialState: "set",
                credentialSealed: record.sealed,
                credentialSetBy: record.setBy,
                credentialSetAt: NOW,
            })
            .where("workspace_id = :workspaceId AND key = :key AND kind = 'remote'", {
                workspaceId: record.workspaceId,
                key: record.key,
            })
            .returning("key")
            .execute()
        return answeredRows(written.raw)
    }

    /** The stored credential of a remote connector (its state and sealed text), or null when there is no such remote connector. */
    async storedCredential(workspaceId: string, key: string): Promise<OptionalStoredConnectorCredential> {
        const connector = await this.entityManager.findOne(McpConnectorEntity, {
            select: { credentialState: true, credentialSealed: true },
            where: { workspaceId, key, kind: "remote" },
        })
        return connector === null
            ? null
            : { state: credentialStateOf(connector.credentialState), sealed: connector.credentialSealed }
    }

    /** One sealed credential of any workspace, or null when none is sealed: the boot proof that the connection key opens it. */
    async sealedSample(): Promise<OptionalSealedCredential> {
        const connector = await this.entityManager.findOne(McpConnectorEntity, {
            select: { credentialSealed: true },
            where: { credentialSealed: Not(IsNull()) },
        })
        return connector?.credentialSealed ?? null
    }

    /** Stores a live catalog snapshot of a connector, the status the read left it in and the check time. */
    async storeCatalog(snapshot: CatalogSnapshot): Promise<void> {
        await this.entityManager
            .createQueryBuilder(McpConnectorEntity, "mc")
            .update()
            .set({
                toolCatalog: CATALOG_JSON,
                catalogHash: snapshot.catalogHash,
                status: snapshot.status,
                checkedAt: NOW,
            })
            .where("workspace_id = :workspaceId AND key = :key", {
                workspaceId: snapshot.workspaceId,
                key: snapshot.key,
            })
            .setParameter("catalogJson", snapshot.catalogJson)
            .execute()
    }

    /** Approves the live catalog of a remote connector; false when it changed since the approval was prepared (nothing written). */
    async approveCatalog(approval: CatalogApproval): Promise<boolean> {
        const approved = await this.entityManager
            .createQueryBuilder(McpConnectorEntity, "mc")
            .update()
            .set({
                approvedCatalog: APPROVED_JSON,
                approvedBy: approval.approvedBy,
                approvedAt: NOW,
            })
            .where("workspace_id = :workspaceId AND key = :key AND kind = 'remote' AND catalog_hash = :catalogHash", {
                workspaceId: approval.workspaceId,
                key: approval.key,
                catalogHash: approval.catalogHash,
            })
            .setParameter("approvedJson", approval.approvedJson)
            .returning("key")
            .execute()
        return answeredRows(approved.raw)
    }

    /** Records one health check of a connector; a disabled connector stays disabled. */
    async recordHealth(record: HealthRecord): Promise<void> {
        await this.entityManager.update(
            McpConnectorEntity,
            { workspaceId: record.workspaceId, key: record.key, status: Not("disabled") },
            { status: record.status, checkedAt: NOW },
        )
    }
}
