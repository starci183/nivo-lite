import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** Whether a connector is native or a remote MCP server. */
export type McpConnectorKind = "native" | "remote"

/** Where a connector stands. */
export type McpConnectorStatus = "active" | "disabled" | "degraded"

/** Whether a remote server takes a credential and whether one is stored. */
export type McpConnectorCredentialState = "none" | "needed" | "set"

/** One tool of the live catalog snapshot of a remote connector. */
export interface McpCatalogTool {
    /** The tool name. */
    name: string
    /** What the tool does. */
    description: string
    /** The JSON schema of its arguments. */
    inputSchema: object
    /** The hash of the tool definition. */
    hash: string
}

/** One approved tool of a remote connector. */
export interface McpApprovedTool {
    /** The tool name. */
    name: string
    /** The hash of the approved definition. */
    hash: string
}

@Entity({ schema: "public", name: "mcp_connectors" })
/** One connector of a workspace's MCP gateway. */
export class McpConnectorEntity extends UuidAbstractEntity {
    /** The workspace that owns the connector. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The namespace key, unique within the workspace. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** `native` or `remote`. */
    @Column({ name: "kind", type: "text" })
    kind!: McpConnectorKind

    /** The remote endpoint, or null for a native row. */
    @Column({ name: "url", type: "text", nullable: true })
    url!: string | null

    /** `active`, `disabled` or `degraded`. */
    @Column({ name: "status", type: "text", default: () => "'active'::text" })
    status!: McpConnectorStatus

    /** The contract version. */
    @Column({ name: "contract_version", type: "text", default: () => "''::text" })
    contractVersion!: string

    /** The per-call limit, milliseconds. */
    @Column({ name: "timeout_ms", type: "integer", default: () => "4000" })
    timeoutMs!: number

    /** The live tool catalog snapshot. */
    @Column({ name: "tool_catalog", type: "jsonb", default: () => "'[]'::jsonb" })
    toolCatalog!: Array<McpCatalogTool>

    /** The sha256 of the live catalog text, or empty. */
    @Column({ name: "catalog_hash", type: "text", default: () => "''::text" })
    catalogHash!: string

    /** The approved { name, hash } pairs. */
    @Column({ name: "approved_catalog", type: "jsonb", default: () => "'[]'::jsonb" })
    approvedCatalog!: Array<McpApprovedTool>

    /** Who approved the catalog, when it was. */
    @Column({ name: "approved_by", type: "uuid", nullable: true })
    approvedBy!: string | null

    /** When the catalog was approved. */
    @Column({ name: "approved_at", type: "timestamptz", nullable: true })
    approvedAt!: Date | null

    /** When the last health check or catalog read answered or failed. */
    @Column({ name: "checked_at", type: "timestamptz", nullable: true })
    checkedAt!: Date | null

    /** `none`, `needed` or `set`. */
    @Column({ name: "credential_state", type: "text", default: () => "'none'::text" })
    credentialState!: McpConnectorCredentialState

    /** The sealed credential (the connection-secrets cipher); never part of a list. */
    @Column({ name: "credential_sealed", type: "text", nullable: true })
    credentialSealed!: string | null

    /** Who stored the credential. */
    @Column({ name: "credential_set_by", type: "uuid", nullable: true })
    credentialSetBy!: string | null

    /** When the credential was last set. */
    @Column({ name: "credential_set_at", type: "timestamptz", nullable: true })
    credentialSetAt!: Date | null
}
