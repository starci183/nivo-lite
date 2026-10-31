import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService, credentialStateOf } from "@modules/domain/mcp-connectors"
import type { CheckStatus, McpConnectorRow } from "@modules/domain/mcp-connectors"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { InjectMcpRemote, isPublicEndpoint } from "@modules/integrations/mcp"
import type { McpEndpoint, McpRemote } from "@modules/integrations/mcp"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    approvalOf,
    callLogViewOf,
    catalogEntryOf,
    constraintsOfJson,
    grantViewOf,
    remoteConnectorOf,
} from "./connector-row.mapper"
import { isBearerCredential } from "./bearer-credential.policy"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { InjectMcpGatewayOptions, InjectNativeAdapters } from "./mcp-gateway.decorators"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import type {
    CallLogQuery,
    CallLogView,
    ConnectorView,
    McpCredentialInput,
    GrantInput,
    GrantView,
    NativeAdapter,
    RemoteConnectorInput,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"
import { McpGatewayService } from "./mcp-gateway.service"
import { addressOf, fullNameOf } from "./tool-name.policy"

const KEY = /^[a-z][a-z0-9-]{1,30}$/u
const WILDCARD = /^[a-z][a-z0-9-]{1,30}\.\*$/u
const ARG = /^[a-zA-Z]\w{0,60}$/u
const LOG_MAX = 200
const LOG_DEFAULT = 50
const MANAGER = ["owner", "manager"] as const

/** The refusal of a console input, naming the field. */
const invalid = (field: string): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.Invalid, params: { field } })

const viewOf = (connector: WorkspaceConnector): ConnectorView => ({
    key: connector.manifest.key,
    name: connector.manifest.name,
    kind: connector.manifest.kind,
    status: connector.status,
    url: connector.url,
    credentialState: connector.credentialState,
    credentialSetAt: connector.credentialSetAt,
    contractVersion: connector.manifest.contractVersion,
    timeoutMs: connector.timeoutMs,
    approvedAt: connector.approvedAt,
    checkedAt: connector.checkedAt,
    tools: connector.manifest.tools.map((spec) => ({
        approved: connector.approvedTools === null || connector.approvedTools.has(spec.name),
        name: fullNameOf(connector.manifest.key, spec.name),
        scope: spec.scope,
        description: spec.description,
    })),
})

@Injectable()
/**
 * The console side of the gateway: registering a remote connector (its URL and its bearer credential, entered once, sealed per
 * workspace with the connection key and never read back: the console only learns whether it is set), rotating that credential,
 * reading its tool catalog from `tools/list` (each tool pinned by the hash of its name, description and schema), approving that
 * catalog, checking its health, the per-agent grants, and the audit log. Every operation needs the owner or manager role, the roles
 * that manage connections: the approval of a catalog is the same authority as a grant.
 */
export class McpGatewayAdminService {
    constructor(
        @InjectMcpGatewayOptions() private readonly options: McpGatewayOptions,
        @InjectNativeAdapters() private readonly natives: ReadonlyArray<NativeAdapter>,
        @InjectMcpRemote() private readonly remote: McpRemote,
        @InjectLogger() private readonly logger: Logger,
        private readonly gateway: McpGatewayService,
        private readonly connectorRows: McpConnectorsService,
        private readonly grantRows: McpToolGrantsService,
        private readonly callLines: McpCallLogService,
        private readonly connections: ConnectionsService,
        private readonly credentials: McpConnectorCredentialService,
    ) {}

    /** The connectors of the workspace with their tools and which of them may run. */
    async connectors(actor: ConnectionActor): Promise<ReadonlyArray<ConnectorView>> {
        await this.connections.authorize(actor, MANAGER)
        return (await this.gateway.connectorsOf(actor.workspaceId)).map(viewOf)
    }

    /** Every grant of the workspace. */
    async grants(actor: ConnectionActor): Promise<ReadonlyArray<GrantView>> {
        await this.connections.authorize(actor, MANAGER)
        return (await this.grantRows.listOfWorkspace(actor.workspaceId)).map(grantViewOf)
    }

    /** The newest audit lines, at most two hundred; no limit means fifty. */
    async callLog(query: CallLogQuery): Promise<ReadonlyArray<CallLogView>> {
        await this.connections.authorize(query.actor, MANAGER)
        const limit = Math.min(LOG_MAX, Math.max(1, Math.round(query.limit ?? LOG_DEFAULT)))
        return (await this.callLines.latest({ workspaceId: query.actor.workspaceId, limit })).map(callLogViewOf)
    }

    /** Sets one grant: a full tool name or `connector.*`, a non-negative limit, well-named constraints, an agent of the workspace. */
    async setGrant(actor: ConnectionActor, input: GrantInput): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        const constraints = constraintsOfJson(input.constraintsJson)
        const limitVnd = input.limitVnd ?? null
        if (constraints === null || constraints.some((entry) => !ARG.test(entry.arg))) throw invalid("constraints")
        if (!WILDCARD.test(input.tool) && addressOf(input.tool) === null) throw invalid("tool")
        if (limitVnd !== null && limitVnd < 0) throw invalid("limitVnd")
        const written = await this.grantRows.set({
            workspaceId: actor.workspaceId,
            agentId: input.agentId,
            tool: input.tool,
            mode: input.mode,
            limitVnd,
            constraints,
            updatedBy: actor.principalId,
        })
        if (!written) throw new McpGatewayError({ code: McpGatewayErrorCode.AgentNotFound })
    }

    /**
     * Registers (or updates) a remote MCP connector. A credential entered with it is sealed into the connector's row (the stored one
     * is kept when none is entered); a server that takes a credential and has none yet stays `needed` and is not read. Otherwise its
     * live catalog is read and pinned. Its tools run only after an owner or manager approves that catalog.
     */
    async registerRemote(actor: ConnectionActor, input: RemoteConnectorInput): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        const credential = input.credential ?? null
        if (!KEY.test(input.key) || this.natives.some((adapter) => adapter.manifest.key === input.key)) throw invalid("key")
        if (input.name.trim() === "") throw invalid("name")
        if (!(await isPublicEndpoint(input.url))) throw invalid("url")
        if (credential !== null && !isBearerCredential(credential)) throw invalid("credential")
        await this.connectorRows.upsertRemote({
            workspaceId: actor.workspaceId,
            key: input.key,
            name: input.name.trim(),
            url: input.url,
            needsCredential: credential !== null || input.needsCredential === true,
            contractVersion: input.contractVersion,
            timeoutMs: input.timeoutMs ?? this.options.defaultTimeoutMs,
        })
        if (credential !== null) await this.credentials.store(actor, input.key, credential)
        const row = await this.remoteRow(actor.workspaceId, input.key)
        if (row.credential_state !== "needed") await this.refresh(actor.workspaceId, row)
    }

    /**
     * Sets or rotates the bearer credential of a remote connector: sealed with the connection key into its row, never read back,
     * then the live catalog is read with it (answers the tool count, 0 when unreachable). The approval stays only while the catalog
     * read with the new credential is the one approved.
     */
    async setCredential(actor: ConnectionActor, input: McpCredentialInput): Promise<number> {
        await this.connections.authorize(actor, MANAGER)
        const plain = input.credential.reveal()
        if (!isBearerCredential(plain)) throw invalid("credential")
        await this.credentials.store(actor, input.key, plain)
        return this.refresh(actor.workspaceId, await this.remoteRow(actor.workspaceId, input.key))
    }

    /** Reads `tools/list` of a remote connector again and stores the live snapshot; answers the count (0 when unreachable). */
    async syncCatalog(actor: ConnectionActor, key: string): Promise<number> {
        await this.connections.authorize(actor, MANAGER)
        return this.refresh(actor.workspaceId, await this.remoteRow(actor.workspaceId, key))
    }

    /**
     * Approves the live catalog of a remote connector exactly as it was read: each tool's schema hash becomes the approved one.
     * A catalog that was not read, or that a read changed meanwhile, is refused. Answers how many tools were approved; the approval
     * keeps who and when, and is logged.
     */
    async approveCatalog(actor: ConnectionActor, key: string): Promise<number> {
        await this.connections.authorize(actor, MANAGER)
        const row = await this.remoteRow(actor.workspaceId, key)
        const approved = approvalOf(row)
        const written =
            row.catalog_hash !== "" &&
            (await this.connectorRows.approveCatalog({
                workspaceId: actor.workspaceId,
                key,
                approvedJson: JSON.stringify(approved),
                catalogHash: row.catalog_hash,
                approvedBy: actor.principalId,
            }))
        if (!written) throw new McpGatewayError({ code: McpGatewayErrorCode.CatalogChanged, params: { key } })
        this.logger.info(McpGatewayLogEvent.CatalogApproved, {
            workspaceId: actor.workspaceId,
            connector: key,
            tools: approved.length,
            approvedBy: actor.principalId,
        })
        return approved.length
    }

    /** Checks that a remote connector answers MCP (`ping`) within its time limit and records the status and the check time. */
    async checkConnector(actor: ConnectionActor, key: string): Promise<CheckStatus> {
        await this.connections.authorize(actor, MANAGER)
        const workspaceId = actor.workspaceId
        const row = await this.remoteRow(workspaceId, key)
        const status = await this.endpointOf(workspaceId, row)
            .then((endpoint) => this.remote.ping(endpoint, remoteConnectorOf(row).timeoutMs))
            .then(
                (): CheckStatus => "active",
                (cause: unknown): CheckStatus => {
                    this.logger.error(McpGatewayLogEvent.HealthFailed, cause, { workspaceId, connector: key })
                    return "degraded"
                },
            )
        await this.connectorRows.recordHealth({ workspaceId, key, status })
        return status
    }

    /** The endpoint of a remote connector row with its opened bearer, through the gateway. */
    private endpointOf(workspaceId: string, row: McpConnectorRow): Promise<McpEndpoint> {
        return this.credentials.endpointOf(workspaceId, {
            key: row.key,
            url: row.url ?? "",
            credentialState: credentialStateOf(row.credential_state),
        })
    }

    /** The remote connector row of a key, or the refusal that it is none. */
    private async remoteRow(workspaceId: string, key: string): Promise<McpConnectorRow> {
        const row = (await this.connectorRows.list(workspaceId)).find(
            (entry) => entry.key === key && entry.kind === "remote",
        )
        if (row === undefined)
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: key } })
        return row
    }

    /** Reads the live catalog of a remote connector into its snapshot; an unreachable server marks it degraded and keeps the last one. */
    private async refresh(workspaceId: string, row: McpConnectorRow): Promise<number> {
        const key = row.key
        try {
            const tools = await this.remote.listTools(
                await this.endpointOf(workspaceId, row),
                remoteConnectorOf(row).timeoutMs,
            )
            const catalogJson = JSON.stringify(tools.map(catalogEntryOf))
            const catalogHash = createHash("sha256").update(catalogJson).digest("hex")
            await this.connectorRows.storeCatalog({ workspaceId, key, catalogJson, catalogHash, status: "active" })
            return tools.length
        } catch (cause) {
            this.logger.error(McpGatewayLogEvent.SyncFailed, cause, { workspaceId, connector: key })
            const catalogJson = JSON.stringify(row.tool_catalog)
            await this.connectorRows.storeCatalog({
                workspaceId,
                key,
                catalogJson,
                catalogHash: "",
                status: "degraded",
            })
            return 0
        }
    }
}
