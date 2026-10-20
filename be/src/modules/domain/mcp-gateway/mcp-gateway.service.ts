import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { McpError, McpErrorCode, McpRemoteClient } from "@modules/integrations/mcp"
import type { McpEndpoint } from "@modules/integrations/mcp"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { argsHashOf, masked, summaryOf } from "./audit-mask.policy"
import { breakerAfter, breakerAllows, CLOSED } from "./circuit-breaker.policy"
import { grantOf, nativeStatusOf, remoteConnectorOf } from "./connector-row.mapper"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { judgeGrant } from "./grant.policy"
import { InjectMcpGatewayOptions, InjectNativeAdapters } from "./mcp-gateway.decorators"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import type {
    BreakerState,
    CallOutcome,
    DescribedTool,
    DiscoveredTool,
    GatewayCaller,
    GatewayCallResult,
    GatewayToolSpec,
    JsonObject,
    NativeAdapter,
    ToolGrant,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"
import type { AgentIdRow, ConnectorRow, GrantRow } from "./persistence/mcp-gateway.rows"
import { AGENTS_GRANTED, INSERT_CALL_LOG, LIST_AGENT_GRANTS, LIST_CONNECTORS } from "./persistence/mcp-gateway.sql"
import { addressOf, fullNameOf, grantFor, searchTools, specOf } from "./tool-name.policy"

/** A resolved call: the connector, the spec and the full name. */
interface Resolved {
    /** The connector. */
    readonly connector: WorkspaceConnector
    /** The tool spec. */
    readonly spec: GatewayToolSpec
    /** The full name. */
    readonly name: string
}

/** What running the adapter came to. */
type Ran =
    | { readonly kind: "ok"; readonly value: JsonObject }
    | { readonly kind: "tool_error"; readonly value: JsonObject }
    | { readonly kind: "failed"; readonly outcome: "timeout" | "error"; readonly code: string }

const failure = (code: "invalid_name" | "unknown_tool" | "connector_disabled", detail: string): GatewayCallResult => ({
    ok: false,
    code,
    detail,
})

@Injectable()
/**
 * The NIVO MCP gateway: one tool surface per workspace over the native adapters registered in code and the remote MCP servers the
 * workspace registered. Every call goes the same way: the name, the connector, the agent's grant (default deny), the limits and the
 * approval, the connector's circuit breaker, the adapter under the connector's time limit, and one masked audit line. A failure is
 * an answer (`unavailable`), never a throw, so a chat turn can fall back to its holding line; the gateway never claims a result the
 * connector did not give.
 */
export class McpGatewayService {
    private readonly breakers = new Map<string, BreakerState>()

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMcpGatewayOptions() private readonly options: McpGatewayOptions,
        @InjectNativeAdapters() private readonly natives: ReadonlyArray<NativeAdapter>,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly remote: McpRemoteClient,
    ) {}

    /** The connectors of a workspace: every native one, and the remote ones it registered. */
    async connectorsOf(workspaceId: string): Promise<ReadonlyArray<WorkspaceConnector>> {
        const rows: ReadonlyArray<ConnectorRow> = await this.entityManager.query(LIST_CONNECTORS, [workspaceId])
        const natives = this.natives.map((adapter): WorkspaceConnector => ({
            manifest: adapter.manifest,
            status: nativeStatusOf(rows, adapter.manifest.key),
            url: null,
            credentialRef: null,
            timeoutMs: this.options.defaultTimeoutMs,
        }))
        const remotes = rows.filter((row) => row.kind === "remote").map(remoteConnectorOf)
        return [...natives, ...remotes]
    }

    /** The grants of one agent. */
    async grantsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ToolGrant>> {
        const rows: ReadonlyArray<GrantRow> = await this.entityManager.query(LIST_AGENT_GRANTS, [workspaceId, agentId])
        return rows.map(grantOf)
    }

    /** The agents of a workspace holding any of the tools (full names or `connector.*`) in a mode other than never, oldest grant first. */
    async agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const rows: ReadonlyArray<AgentIdRow> = await this.entityManager.query(AGENTS_GRANTED, [workspaceId, tools])
        return [...new Set(rows.map((row) => row.agent_id))]
    }

    /** Discovery: the granted tools matching a query, at most ten, so an agent never loads every tool of every connector. */
    async search(caller: GatewayCaller, query: string, limit: number): Promise<ReadonlyArray<DiscoveredTool>> {
        const [connectors, grants] = await Promise.all([
            this.connectorsOf(caller.workspaceId),
            this.grantsOf(caller.workspaceId, caller.agentId),
        ])
        const active = connectors.filter((connector) => connector.status !== "disabled")
        return searchTools(
            active.map((connector) => connector.manifest),
            grants,
            query,
            limit,
        )
    }

    /** One granted tool in full (schema and limits); null when it does not exist or the caller is not granted it. */
    async describe(caller: GatewayCaller, name: string): Promise<DescribedTool | null> {
        const [resolved, grants] = await Promise.all([
            this.resolve(caller.workspaceId, name),
            this.grantsOf(caller.workspaceId, caller.agentId),
        ])
        const grant = grantFor(grants, name)
        if ("ok" in resolved || grant === null || grant.mode === "never") return null
        const { spec } = resolved
        return {
            name,
            description: spec.description,
            scope: spec.scope,
            mode: grant.mode,
            inputSchema: spec.inputSchema,
            constraints: grant.constraints,
            limitVnd: grant.limitVnd,
        }
    }

    /** Calls one tool for an agent through the grant, the approval, the breaker, the time limit and the audit. */
    async call(caller: GatewayCaller, name: string, args: JsonObject): Promise<GatewayCallResult> {
        const started = this.clock.now().getTime()
        const resolved = await this.resolve(caller.workspaceId, name)
        if ("ok" in resolved) return resolved
        const { connector, spec } = resolved
        const grant = grantFor(await this.grantsOf(caller.workspaceId, caller.agentId), name)
        const verdict = judgeGrant(grant, args, caller.approvedBy !== undefined, spec.scope !== "read")
        if (verdict.kind === "refuse") {
            await this.audit(caller, resolved, args, { outcome: "refused", code: "not_granted", summary: "", started })
            return { ok: false, code: "not_granted", detail: name }
        }
        if (verdict.kind === "approval") {
            await this.audit(caller, resolved, args, {
                outcome: "approval",
                code: verdict.reason,
                summary: "",
                started,
            })
            return { ok: false, code: "approval_required", reason: verdict.reason }
        }
        const breakerKey = `${caller.workspaceId}:${connector.manifest.key}`
        if (!breakerAllows(this.breakers.get(breakerKey) ?? CLOSED, started)) {
            await this.audit(caller, resolved, args, {
                outcome: "circuit_open",
                code: "unavailable",
                summary: "",
                started,
            })
            return { ok: false, code: "unavailable", detail: "circuit_open" }
        }
        const ran = await this.run(caller.workspaceId, connector, spec.name, args)
        const now = this.clock.now().getTime()
        this.breakers.set(breakerKey, breakerAfter(this.breakers.get(breakerKey) ?? CLOSED, ran.kind !== "failed", now))
        return this.answer(caller, resolved, args, ran, started)
    }

    private async answer(
        caller: GatewayCaller,
        resolved: Resolved,
        args: JsonObject,
        ran: Ran,
        started: number,
    ): Promise<GatewayCallResult> {
        const secrets = resolved.spec.secretFields ?? []
        if (ran.kind === "failed") {
            await this.audit(caller, resolved, args, { outcome: ran.outcome, code: ran.code, summary: "", started })
            return { ok: false, code: "unavailable", detail: ran.code }
        }
        const summary = summaryOf(ran.value, secrets)
        if (ran.kind === "tool_error") {
            await this.audit(caller, resolved, args, { outcome: "error", code: "tool_error", summary, started })
            return { ok: false, code: "tool_error", detail: summary }
        }
        await this.audit(caller, resolved, args, { outcome: "ok", code: null, summary, started })
        return { ok: true, value: ran.value }
    }

    /** The connector and spec of a full name, or the failure that stops the call before any grant is read. */
    private async resolve(workspaceId: string, name: string): Promise<Resolved | GatewayCallResult> {
        const address = addressOf(name)
        if (address === null) return failure("invalid_name", name)
        const connectors = await this.connectorsOf(workspaceId)
        const connector = connectors.find((entry) => entry.manifest.key === address.connector)
        const spec = connector === undefined ? null : specOf(connector.manifest, address.tool)
        if (connector === undefined || spec === null) return failure("unknown_tool", name)
        if (connector.status === "disabled") return failure("connector_disabled", connector.manifest.key)
        return { connector, spec, name: fullNameOf(connector.manifest.key, spec.name) }
    }

    /** Runs the adapter under the time limit; every failure is an answer. */
    private async run(
        workspaceId: string,
        connector: WorkspaceConnector,
        tool: string,
        args: JsonObject,
    ): Promise<Ran> {
        try {
            if (connector.manifest.kind === "remote") {
                const result = await this.remote.call(this.endpointOf(connector), tool, args, connector.timeoutMs)
                return result.isError
                    ? { kind: "tool_error", value: result.value }
                    : { kind: "ok", value: result.value }
            }
            return { kind: "ok", value: await this.native(workspaceId, connector, tool, args) }
        } catch (cause) {
            this.logger.error(McpGatewayLogEvent.CallFailed, cause, {
                workspaceId,
                connector: connector.manifest.key,
                tool,
            })
            const timedOut =
                (cause instanceof McpError && cause.code === McpErrorCode.Timeout) ||
                (cause instanceof McpGatewayError && cause.code === McpGatewayErrorCode.Timeout)
            const code = cause instanceof McpError || cause instanceof McpGatewayError ? cause.code : "internal"
            return { kind: "failed", outcome: timedOut ? "timeout" : "error", code }
        }
    }

    private async native(
        workspaceId: string,
        connector: WorkspaceConnector,
        tool: string,
        args: JsonObject,
    ): Promise<JsonObject> {
        const adapter = this.natives.find((entry) => entry.manifest.key === connector.manifest.key)
        if (adapter === undefined)
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        let timer: NodeJS.Timeout | undefined
        const limit = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                reject(new McpGatewayError({ code: McpGatewayErrorCode.Timeout, params: { tool } }))
            }, connector.timeoutMs)
        })
        try {
            return await Promise.race([adapter.invoke(workspaceId, tool, args), limit])
        } finally {
            clearTimeout(timer)
        }
    }

    /** The endpoint of a remote connector with its credential, read by NAME from the secrets the gateway holds. */
    private endpointOf(connector: WorkspaceConnector): McpEndpoint {
        const ref = connector.credentialRef
        if (ref === null) return { url: connector.url ?? "", bearer: null }
        const secret = this.options.credentials.get(ref)
        if (secret === undefined) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.CredentialMissing, params: { ref } })
        }
        return { url: connector.url ?? "", bearer: secret.reveal() }
    }

    private async audit(
        caller: GatewayCaller,
        resolved: Resolved,
        args: JsonObject,
        line: {
            readonly outcome: CallOutcome
            readonly code: string | null
            readonly summary: string
            readonly started: number
        },
    ): Promise<void> {
        const secrets = resolved.spec.secretFields ?? []
        await this.entityManager.query(INSERT_CALL_LOG, [
            caller.workspaceId,
            resolved.connector.manifest.key,
            resolved.name,
            caller.agentId,
            caller.conversationId,
            caller.workItemId,
            JSON.stringify(masked(args, secrets)),
            argsHashOf(args),
            line.outcome,
            line.code,
            line.summary,
            Math.max(0, this.clock.now().getTime() - line.started),
            caller.approvedBy ?? null,
        ])
    }
}
