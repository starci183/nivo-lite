import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { McpRemoteClient } from "@modules/integrations/mcp"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    callLogViewOf,
    catalogEntryOf,
    constraintsOfJson,
    grantViewOf,
    remoteConnectorOf,
} from "./connector-row.mapper"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { InjectMcpGatewayOptions } from "./mcp-gateway.decorators"
import type { CallLogView, ConnectorView, GrantMode, GrantView, WorkspaceConnector } from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"
import { McpGatewayService } from "./mcp-gateway.service"
import type { CallLogRow, ConnectorRow, WorkspaceGrantRow } from "./persistence/mcp-gateway.rows"
import {
    LIST_CALL_LOG,
    LIST_CONNECTORS,
    LIST_WORKSPACE_GRANTS,
    UPDATE_CATALOG,
    UPSERT_GRANT,
    UPSERT_REMOTE_CONNECTOR,
} from "./persistence/mcp-gateway.sql"
import { addressOf, fullNameOf } from "./tool-name.policy"

const KEY = /^[a-z][a-z0-9-]{1,30}$/u
const CREDENTIAL_REF = /^[A-Z][A-Z0-9_]{2,80}$/u
const LOG_MAX = 200
const LOG_DEFAULT = 50
const MANAGER = ["owner", "manager"] as const
const ARG = /^[a-zA-Z][a-zA-Z0-9_]{0,60}$/u

/** A remote connector to register. */
export interface RemoteConnectorInput {
    /** The namespace. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** The Streamable HTTP endpoint. */
    readonly url: string
    /** The NAME of the credential secret, or null / absent. */
    readonly credentialRef?: string | null
    /** The contract version. */
    readonly contractVersion: string
    /** The per-call limit; null / absent keeps the gateway default. */
    readonly timeoutMs?: number | null
}

/** One grant to set. */
export interface GrantInput {
    /** The agent. */
    readonly agentId: string
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** The mode. */
    readonly mode: GrantMode
    /** The amount limit, or null / absent for none. */
    readonly limitVnd?: number | null
    /** The argument constraints as JSON ([{ "arg": "discountPct", "max": 5 }]), or null / absent for none. */
    readonly constraintsJson?: string | null
}

const invalid = (field: string): never => {
    throw new McpGatewayError({ code: McpGatewayErrorCode.Invalid, params: { field } })
}

const viewOf = (connector: WorkspaceConnector): ConnectorView => ({
    key: connector.manifest.key,
    name: connector.manifest.name,
    kind: connector.manifest.kind,
    status: connector.status,
    url: connector.url,
    credentialRef: connector.credentialRef,
    contractVersion: connector.manifest.contractVersion,
    timeoutMs: connector.timeoutMs,
    tools: connector.manifest.tools.map((spec) => ({
        name: fullNameOf(connector.manifest.key, spec.name),
        scope: spec.scope,
        description: spec.description,
    })),
})

const isUrl = (value: string): boolean => {
    try {
        const url = new URL(value)
        return url.protocol === "https:" || url.protocol === "http:"
    } catch {
        return false
    }
}

@Injectable()
/**
 * The console side of the gateway: registering a remote connector (its URL and the NAME of its credential, never the value), syncing
 * its tool catalog from `tools/list`, the per-agent grants, and the audit log. Authorization (owner or manager) is the caller's.
 */
export class McpGatewayAdminService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMcpGatewayOptions() private readonly options: McpGatewayOptions,
        private readonly gateway: McpGatewayService,
        private readonly remote: McpRemoteClient,
        private readonly connections: ConnectionsService,
    ) {}

    /** The connectors of the workspace with their tools (owner or manager). */
    async connectors(actor: ConnectionActor): Promise<ReadonlyArray<ConnectorView>> {
        await this.connections.authorize(actor, MANAGER)
        return (await this.gateway.connectorsOf(actor.workspaceId)).map(viewOf)
    }

    /** Every grant of the workspace (owner or manager). */
    async grants(actor: ConnectionActor): Promise<ReadonlyArray<GrantView>> {
        await this.connections.authorize(actor, MANAGER)
        const workspaceId = actor.workspaceId
        const rows: ReadonlyArray<WorkspaceGrantRow> = await this.entityManager.query(LIST_WORKSPACE_GRANTS, [
            workspaceId,
        ])
        return rows.map(grantViewOf)
    }

    /** The latest audit lines (owner or manager); no limit means fifty. */
    async callLog(actor: ConnectionActor, limit: number | null | undefined): Promise<ReadonlyArray<CallLogView>> {
        await this.connections.authorize(actor, MANAGER)
        const bounded = Math.min(LOG_MAX, Math.max(1, Math.round(limit ?? LOG_DEFAULT)))
        const rows: ReadonlyArray<CallLogRow> = await this.entityManager.query(LIST_CALL_LOG, [
            actor.workspaceId,
            bounded,
        ])
        return rows.map(callLogViewOf)
    }

    /** Sets one grant; a tool name must be a full name or `connector.*`, limits are non-negative, the agent the workspace's. */
    async setGrant(actor: ConnectionActor, input: GrantInput): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        const workspaceId = actor.workspaceId
        const constraints = constraintsOfJson(input.constraintsJson)
        const limitVnd = input.limitVnd ?? null
        if (constraints === null) invalid("constraints")
        const [connector = "", rest = ""] = input.tool.split(/\.(.*)/su)
        const wildcard = rest === "*" && KEY.test(connector)
        if (!wildcard && addressOf(input.tool) === null) invalid("tool")
        if (limitVnd !== null && limitVnd < 0) invalid("limitVnd")
        if ((constraints ?? []).some((entry) => !ARG.test(entry.arg))) invalid("constraints")
        const rows: ReadonlyArray<unknown> = await this.entityManager.query(UPSERT_GRANT, [
            workspaceId,
            input.agentId,
            input.tool,
            input.mode,
            limitVnd,
            JSON.stringify(constraints ?? []),
            actor.principalId,
        ])
        if (rows.length === 0) throw new McpGatewayError({ code: McpGatewayErrorCode.AgentNotFound })
    }

    /** Registers (or updates) a remote MCP connector; the credential is a NAME the gateway was given through `<NAME>_FILE`. */
    async registerRemote(actor: ConnectionActor, input: RemoteConnectorInput): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        const workspaceId = actor.workspaceId
        const credentialRef = input.credentialRef ?? null
        if (!KEY.test(input.key)) invalid("key")
        if (input.name.trim() === "") invalid("name")
        if (!isUrl(input.url)) invalid("url")
        if (credentialRef !== null) {
            if (!CREDENTIAL_REF.test(credentialRef)) invalid("credentialRef")
            if (!this.options.credentials.has(credentialRef)) {
                throw new McpGatewayError({
                    code: McpGatewayErrorCode.CredentialMissing,
                    params: { ref: credentialRef },
                })
            }
        }
        await this.entityManager.query(UPSERT_REMOTE_CONNECTOR, [
            workspaceId,
            input.key,
            input.name.trim(),
            input.url,
            credentialRef,
            input.contractVersion,
            input.timeoutMs ?? this.options.defaultTimeoutMs,
        ])
    }

    /** Reads `tools/list` of a remote connector and stores the snapshot; an unreachable server marks it degraded. Answers the count. */
    async syncCatalog(actor: ConnectionActor, key: string): Promise<number> {
        await this.connections.authorize(actor, MANAGER)
        const workspaceId = actor.workspaceId
        const rows: ReadonlyArray<ConnectorRow> = await this.entityManager.query(LIST_CONNECTORS, [workspaceId])
        const row = rows.find((entry) => entry.key === key && entry.kind === "remote")
        if (row === undefined)
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: key } })
        const connector = remoteConnectorOf(row)
        const secret = row.credential_ref === null ? undefined : this.options.credentials.get(row.credential_ref)
        try {
            const tools = await this.remote.listTools(
                { url: connector.url ?? "", bearer: secret?.reveal() ?? null },
                connector.timeoutMs,
            )
            const catalog = JSON.stringify(tools.map(catalogEntryOf))
            const hash = createHash("sha256").update(catalog).digest("hex")
            await this.entityManager.query(UPDATE_CATALOG, [workspaceId, key, catalog, hash, "active"])
            return tools.length
        } catch {
            await this.entityManager.query(UPDATE_CATALOG, [
                workspaceId,
                key,
                JSON.stringify(row.tool_catalog),
                "",
                "degraded",
            ])
            return 0
        }
    }
}
