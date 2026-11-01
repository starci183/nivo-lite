import { createHash } from "node:crypto"
import { Injectable, Optional } from "@nestjs/common"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { GatewayReceiptsService } from "@modules/domain/mcp-gateway-receipts"
import type { GatewayReceiptOperation } from "@modules/domain/mcp-gateway-receipts"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { InjectMcpRemote } from "@modules/integrations/mcp"
import type { McpRemote } from "@modules/integrations/mcp"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { argsHashOf, masked, summaryOf } from "./audit-mask.policy"
import { breakerAfter, breakerGate, CLOSED } from "./circuit-breaker.policy"
import { failureCodeOf, isTimeout, roleIn, usable, toolVisibleTo } from "./connector-call.policy"
import { isTainted, withTaint } from "./taint.policy"
import { grantOf, nativeConnectorOf, remoteConnectorOf } from "./connector-row.mapper"
import { judgeGrant } from "./grant.policy"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import { withReplayKey } from "./idempotency-key.policy"
import { InjectDataRightsGate, InjectMcpGatewayOptions, InjectNativeAdapters } from "./mcp-gateway.decorators"
import { applyFields, judgeDataRight } from "./data-rights.policy"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import type {
    BreakerState,
    CapabilityRole,
    CallOutcome,
    DataRight,
    DataRightsGate,
    DataRightVerdict,
    DiscoveredTool,
    GatewayCaller,
    GatewayCallResult,
    GatewayJson,
    GatewayToolSpec,
    NativeAdapter,
    OptionalDescribedTool,
    RoleReadiness,
    RoleResolution,
    ToolGrant,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"
import { NativeRunnerService } from "./native-runner.service"
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

/** The stable client intent and the schema-dependent payload of one connector call. */
interface GatewayArguments {
    /** The caller's arguments before the gateway adds any remote replay field. */
    readonly original: GatewayJson
    /** The arguments authorized, audited and sent under the current approved schema. */
    readonly forwarded: GatewayJson
}

/** What running the adapter came to. */
type Ran =
    | { readonly kind: "ok"; readonly value: GatewayJson }
    | { readonly kind: "tool_error"; readonly value: GatewayJson }
    | { readonly kind: "failed"; readonly outcome: "timeout" | "error"; readonly code: string }

/** One audit line of a resolved call, before the caller and the call are added. */
interface AuditLine {
    /** The outcome. */
    readonly outcome: CallOutcome
    /** The failure code, or null. */
    readonly code: string | null
    /** The masked result summary. */
    readonly summary: string
    /** When the call started, epoch ms. */
    readonly started: number
}

/** What the receipt of arguments refused by the generic bound records: the refused tree is unbounded, so it is never serialized. */
const UNRECORDED_ARGUMENTS: GatewayJson = {}

/** The answer of a call that stops before any connector is reached. */
const failure = (code: "invalid_name" | "unknown_tool" | "connector_disabled", detail: string): GatewayCallResult => ({
    ok: false,
    code,
    detail,
})

/**
 * True when a timed-out write carries a nonblank string replay key, so the server can return its stored result instead of acting twice.
 */
const replayable = (spec: GatewayToolSpec, args: GatewayJson, ran: Ran): boolean => {
    if (
        ran.kind !== "failed" ||
        ran.outcome !== "timeout" ||
        spec.scope === "read" ||
        spec.idempotencyArg === undefined
    )
        return false
    const key = args[spec.idempotencyArg]
    return typeof key === "string" && key.trim() !== ""
}

@Injectable()
/**
 * The NIVO MCP gateway: one tool surface per workspace over the native adapters registered in code and the remote MCP servers the
 * workspace registered. Every call goes the same way: the name, the connector, the approved schema of a remote tool, the agent's
 * grant (default deny), the limits and the approval, the connector's circuit breaker (per workspace and connector, so one slow
 * connector never stalls another), the adapter under the connector's time limit, and one masked audit line. A failure is an answer
 * (`unavailable`), never a throw, so a chat turn can fall back to its holding line; the gateway never claims a result the
 * connector did not give. A side-effect remote call carries a replay key derived from its step, so a retry never acts twice.
 */
export class McpGatewayService {
    private readonly breakers = new Map<string, BreakerState>()
    /** The turns that read text a stranger may have written, and when (per process, like the breakers). */
    private tainted: ReadonlyMap<string, number> = new Map()

    constructor(
        @InjectMcpGatewayOptions() private readonly options: McpGatewayOptions,
        @InjectNativeAdapters() private readonly natives: ReadonlyArray<NativeAdapter>,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMcpRemote() private readonly remote: McpRemote,
        private readonly connectors: McpConnectorsService,
        private readonly grants: McpToolGrantsService,
        private readonly callLog: McpCallLogService,
        private readonly credentials: McpConnectorCredentialService,
        private readonly receipts: GatewayReceiptsService,
        private readonly nativeRunner: NativeRunnerService,
        @Optional() @InjectDataRightsGate() private readonly dataRights: DataRightsGate | null = null,
    ) {}

    /** The connectors of a workspace: every native one, and the remote ones it registered. */
    async connectorsOf(workspaceId: string): Promise<ReadonlyArray<WorkspaceConnector>> {
        const rows = await this.connectors.list(workspaceId)
        const natives = this.natives.map((adapter) => nativeConnectorOf(rows, adapter, this.options.defaultTimeoutMs))
        const remotes = rows.filter((row) => row.kind === "remote").map(remoteConnectorOf)
        return [...natives, ...remotes]
    }

    /**
     * The tool a workspace plays a capability role with: the first tool declaring the role among the connectors that are not
     * disabled (natives first, then remotes by key) that may run (a remote tool only while its approved schema is live). Grants are
     * not judged here: the caller then calls the tool, and the grant, the approval and the audit apply as to any call. None is the
     * typed `no_capability` answer.
     */
    async toolForRole(workspaceId: string, role: CapabilityRole): Promise<RoleResolution> {
        return roleIn(await this.connectorsOf(workspaceId), role)
    }

    /**
     * Whether a workspace can play the roles a NIVO agent requires now (each role has a usable tool), the roles it misses, and for
     * every role the display names of the connectors that declare it (installed or installable), so a card can say what to connect.
     */
    async readiness(workspaceId: string, roles: ReadonlyArray<CapabilityRole>): Promise<RoleReadiness> {
        const connectors = await this.connectorsOf(workspaceId)
        const missing = roles.filter((role) => !roleIn(connectors, role).ok)
        const providersOf = (role: CapabilityRole): ReadonlyArray<string> => [
            ...new Set(
                connectors
                    .filter((connector) => connector.manifest.tools.some((spec) => spec.role === role))
                    .map((connector) => connector.manifest.name),
            ),
        ]
        return {
            ready: missing.length === 0,
            missing,
            providers: {
                "identity.find": providersOf("identity.find"),
                "identity.upsert": providersOf("identity.upsert"),
                "receivable.find": providersOf("receivable.find"),
                "receivable.recordPayment": providersOf("receivable.recordPayment"),
                "payment.credits.list": providersOf("payment.credits.list"),
                "payment.debits.list": providersOf("payment.debits.list"),
                "invoice.list": providersOf("invoice.list"),
            },
        }
    }

    /** The grants of one agent. */
    async grantsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ToolGrant>> {
        return (await this.grants.listOfAgent(workspaceId, agentId)).map(grantOf)
    }

    /** The agents of a workspace holding any of the tools (full names or `connector.*`) in a mode other than never, oldest grant first. */
    agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        return this.grants.agentsGranted(workspaceId, tools)
    }

    /**
     * Discovery: the tools matching a query among those the caller may use (installed, approved, granted), at most ten, so an
     * agent never loads every schema of every connector.
     */
    async search(caller: GatewayCaller, query: string, limit: number): Promise<ReadonlyArray<DiscoveredTool>> {
        const [connectors, grants] = await Promise.all([
            this.connectorsOf(caller.workspaceId),
            this.grantsOf(caller.workspaceId, caller.agentId),
        ])
        const active = connectors.filter((connector) => connector.status !== "disabled")
        const manifests = active.map((connector) => ({
            ...connector.manifest,
            tools: connector.manifest.tools.filter(
                (spec) => usable(connector, spec.name) && toolVisibleTo(caller, spec),
            ),
        }))
        return searchTools(manifests, grants, query, limit)
    }

    /** One usable granted tool in full (schema and limits); null when it does not exist, is not approved or not granted. */
    async describe(caller: GatewayCaller, name: string): Promise<OptionalDescribedTool> {
        const [resolved, grants] = await Promise.all([
            this.resolve(caller.workspaceId, name),
            this.grantsOf(caller.workspaceId, caller.agentId),
        ])
        const grant = grantFor(grants, name)
        if ("ok" in resolved || !usable(resolved.connector, resolved.spec.name)) return null
        if (!toolVisibleTo(caller, resolved.spec)) return null
        if (grant === null || grant.mode === "never") return null
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

    /** Calls one tool through its schema, grant, approval and breaker; non-read tools require a nonblank operation key or work item. */
    async call(caller: GatewayCaller, name: string, args: GatewayJson): Promise<GatewayCallResult> {
        const started = this.clock.now().getTime()
        const parsed = gatewayArgumentsSchema.safeParse(args)
        const resolved = await this.resolve(caller.workspaceId, name)
        if (!parsed.success) return this.refuseArguments(caller, resolved, UNRECORDED_ARGUMENTS, started)
        if ("ok" in resolved) return resolved
        if (!toolVisibleTo(caller, resolved.spec)) {
            await this.audit(caller, resolved, parsed.data, {
                outcome: "refused",
                code: "internal_only",
                summary: "",
                started,
            })
            return { ok: false, code: "internal_only", detail: name }
        }
        if (resolved.spec.argumentSchema?.safeParse(parsed.data).success === false)
            return this.refuseArguments(caller, resolved, parsed.data, started)
        const sent = withReplayKey(resolved.spec, caller, resolved.name, parsed.data)
        if (!usable(resolved.connector, resolved.spec.name)) {
            await this.audit(caller, resolved, sent, {
                outcome: "refused",
                code: "schema_unapproved",
                summary: "",
                started,
            })
            return { ok: false, code: "schema_unapproved", detail: name }
        }
        const grant = grantFor(await this.grantsOf(caller.workspaceId, caller.agentId), name)
        const verdict = judgeGrant(grant, sent, caller.approvedBy !== undefined, resolved.spec.scope !== "read")
        if (verdict.kind === "refuse") {
            await this.audit(caller, resolved, sent, { outcome: "refused", code: "not_granted", summary: "", started })
            return { ok: false, code: "not_granted", detail: name }
        }
        if (verdict.kind === "approval") {
            await this.audit(caller, resolved, sent, {
                outcome: "approval",
                code: verdict.reason,
                summary: "",
                started,
            })
            return { ok: false, code: "approval_required", reason: verdict.reason }
        }
        const reach = await this.reachOf(caller, resolved)
        if (reach.kind === "deny") {
            await this.audit(caller, resolved, sent, {
                outcome: "refused",
                code: "no_data_right",
                summary: reach.reason,
                started,
            })
            return { ok: false, code: "not_granted", detail: "no_data_right" }
        }
        if (this.mustAsk(caller, resolved)) {
            await this.audit(caller, resolved, sent, {
                outcome: "approval",
                code: "tainted_input",
                summary: "",
                started,
            })
            return { ok: false, code: "approval_required", reason: "tainted_input" }
        }
        return this.guarded(
            caller,
            resolved,
            { original: args, forwarded: sent },
            started,
            reach.kind === "narrow" ? reach.right : null,
        )
    }

    /** What the agent's data rights decide about a native read: every other call, and an agent no enforced graph governs, passes untouched. */
    private async reachOf(caller: GatewayCaller, resolved: Resolved): Promise<DataRightVerdict> {
        const gate = this.dataRights
        if (gate === null || resolved.connector.manifest.kind !== "native" || resolved.spec.scope !== "read")
            return { kind: "open" }
        return judgeDataRight(await gate.rightsOf(caller.workspaceId, caller.agentId), resolved.name, caller)
    }

    /** True for a write of a turn that read tainted text, unless a person approved this exact call: the grant alone does not carry it. */
    private mustAsk(caller: GatewayCaller, resolved: Resolved): boolean {
        return (
            resolved.spec.scope !== "read" &&
            caller.approvedBy === undefined &&
            isTainted(this.tainted, caller, this.clock.now().getTime())
        )
    }

    /** Refuses invalid arguments, with a receipt when the tool resolves (an unknown tool has no connector to file it under). */
    private async refuseArguments(
        caller: GatewayCaller,
        resolved: Resolved | GatewayCallResult,
        args: GatewayJson,
        started: number,
    ): Promise<GatewayCallResult> {
        if (!("ok" in resolved))
            await this.audit(caller, resolved, args, {
                outcome: "refused",
                code: "invalid_arguments",
                summary: "",
                started,
            })
        return { ok: false, code: "invalid_arguments", detail: "Invalid tool arguments" }
    }

    /** The breaker of a workspace's connector; one that never failed is closed. */
    private breakerOf(key: string): BreakerState {
        return this.breakers.get(key) ?? CLOSED
    }

    /** Runs an allowed call behind its connector's breaker and records what it came to. */
    private async guarded(
        caller: GatewayCaller,
        resolved: Resolved,
        args: GatewayArguments,
        started: number,
        right: DataRight | null,
    ): Promise<GatewayCallResult> {
        const step = caller.opKey ?? caller.workItemId
        if (resolved.spec.scope !== "read" && (step === null || step.trim() === "")) {
            await this.audit(caller, resolved, args.forwarded, {
                outcome: "refused",
                code: "idempotency_key_required",
                summary: "",
                started,
            })
            return { ok: false, code: "idempotency_key_required", detail: resolved.name }
        }
        const breakerKey = `${caller.workspaceId}:${resolved.connector.manifest.key}`
        const gate = breakerGate(this.breakerOf(breakerKey), started)
        if (resolved.spec.scope === "read" || !gate.allowed) {
            return this.execute(caller, resolved, args.forwarded, started, right)
        }
        const key = createHash("sha256")
            .update(JSON.stringify([caller.workspaceId, step, resolved.name, argsHashOf(args.original)]))
            .digest("hex")
        const operation: GatewayReceiptOperation = () => this.execute(caller, resolved, args.forwarded, started, right)
        return this.receipts.run(caller.workspaceId, key, operation)
    }

    /** Invokes the connector only for a live read or the winner of a durable write claim. */
    private async execute(
        caller: GatewayCaller,
        resolved: Resolved,
        args: GatewayJson,
        started: number,
        right: DataRight | null,
    ): Promise<GatewayCallResult> {
        const breakerKey = `${caller.workspaceId}:${resolved.connector.manifest.key}`
        const gate = breakerGate(this.breakerOf(breakerKey), started)
        this.breakers.set(breakerKey, gate.state)
        if (!gate.allowed) {
            await this.audit(caller, resolved, args, {
                outcome: "circuit_open",
                code: "unavailable",
                summary: "",
                started,
            })
            return { ok: false, code: "unavailable", detail: "circuit_open" }
        }
        const first = await this.run(caller, resolved, args)
        const ran = replayable(resolved.spec, args, first) ? await this.run(caller, resolved, args) : first
        const now = this.clock.now().getTime()
        this.breakers.set(breakerKey, breakerAfter(this.breakerOf(breakerKey), ran.kind !== "failed", now))
        return this.answer(caller, resolved, args, ran, started, right)
    }

    private async answer(
        caller: GatewayCaller,
        resolved: Resolved,
        args: GatewayJson,
        ran: Ran,
        started: number,
        right: DataRight | null,
    ): Promise<GatewayCallResult> {
        if (ran.kind === "failed") {
            const unknown = ran.outcome === "timeout" && resolved.spec.scope !== "read"
            const code = unknown ? "unknown_outcome" : ran.code
            await this.audit(caller, resolved, args, { outcome: ran.outcome, code, summary: "", started })
            return { ok: false, code: unknown ? "unknown_outcome" : "unavailable", detail: ran.code }
        }
        const shown = ran.kind === "ok" && right !== null ? applyFields(ran.value, right) : ran.value
        const summary = summaryOf(shown, resolved.spec.secretFields)
        if (ran.kind === "tool_error") {
            await this.audit(caller, resolved, args, { outcome: "error", code: "tool_error", summary, started })
            return { ok: false, code: "tool_error", detail: summary }
        }
        await this.audit(caller, resolved, args, { outcome: "ok", code: null, summary, started })
        if (resolved.spec.taints === true) this.tainted = withTaint(this.tainted, caller, this.clock.now().getTime())
        return { ok: true, value: shown }
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

    /** Runs the adapter under the connector's time limit; every failure is an answer. */
    private async run(caller: GatewayCaller, resolved: Resolved, args: GatewayJson): Promise<Ran> {
        const { workspaceId } = caller
        const { connector, spec } = resolved
        const adapter = this.natives.find(
            (entry) => connector.manifest.kind === "native" && entry.manifest.key === connector.manifest.key,
        )
        try {
            if (adapter !== undefined) {
                return await this.nativeRunner.run(adapter, caller, spec.name, connector.timeoutMs, args)
            }
            const endpoint = await this.credentials.endpointOf(workspaceId, {
                key: connector.manifest.key,
                url: connector.url ?? "",
                credentialState: connector.credentialState,
            })
            const result = await this.remote.call({
                endpoint,
                name: spec.name,
                args,
                timeoutMs: connector.timeoutMs,
            })
            return { kind: result.isError ? "tool_error" : "ok", value: result.value }
        } catch (cause) {
            this.logger.error(McpGatewayLogEvent.CallFailed, cause, {
                workspaceId,
                connector: connector.manifest.key,
                tool: spec.name,
            })
            return { kind: "failed", outcome: isTimeout(cause) ? "timeout" : "error", code: failureCodeOf(cause) }
        }
    }

    private async audit(caller: GatewayCaller, resolved: Resolved, args: GatewayJson, line: AuditLine): Promise<void> {
        await this.callLog.append({
            workspaceId: caller.workspaceId,
            connector: resolved.connector.manifest.key,
            tool: resolved.name,
            agentId: caller.agentId,
            conversationId: caller.conversationId,
            workItemId: caller.workItemId,
            argsMaskedJson: JSON.stringify(masked(args, resolved.spec.secretFields)),
            argsHash: argsHashOf(args),
            outcome: line.outcome,
            errorCode: line.code,
            resultSummary: line.summary,
            durationMs: Math.max(0, this.clock.now().getTime() - line.started),
            approvedBy: caller.approvedBy ?? null,
        })
    }
}
