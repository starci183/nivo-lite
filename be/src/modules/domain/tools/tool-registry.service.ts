import { createHash } from "node:crypto"
import { Injectable, Optional } from "@nestjs/common"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { providerCallCause, proofOf, type ProviderCallProof } from "@modules/domain/provider-registry"
import { ToolReceiptsService, type ToolReceiptOperation } from "@modules/domain/tool-receipts"
import { ToolGrantsService } from "@modules/domain/tool-grants"
import { outsideRefusalOf } from "@modules/domain/openapi-tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { argsHashOf, masked, summaryOf } from "./audit-mask.policy"
import { statedRecordsOf, type StatedRecords } from "./call-records.policy"
import { truthReadsOf, type TruthRead } from "./truth-reads.policy"
import { breakerAfter, breakerGate, CLOSED } from "./circuit-breaker.policy"
import { failureCodeOf, isTimeout, toolVisibleTo } from "./tool-call.policy"
import { isTainted, withTaint } from "./taint.policy"
import { grantOf, toolFamilyOf } from "./tool-rows.mapper"
import { grantVerdictOf } from "./grant.policy"
import { InjectNodeRequestsGate } from "./node-requests.decorators"
import { modeSourceOf, modeVerdictOf, type ModeVerdict, type NodeRequestsGate } from "./node-mode.policy"
import { isProviderParted, type AccountTarget, type AttachmentVerdict } from "./provider-abilities.policy"
import { AgentAccountsService } from "./agent-accounts.service"
import { toolArgumentsSchema } from "./tool-arguments.schema"
import { withReplayKey } from "./idempotency-key.policy"
import { InjectToolsOptions, InjectNativeToolFamilies } from "./tools.decorators"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import { ToolsLogEvent } from "./tools.log-events"
import type {
    BreakerState,
    CallOutcome,
    ToolCaller,
    ToolCallResult,
    ToolJson,
    ManifestTool,
    GrantVerdict,
    NativeToolFamily,
    ProviderPart,
    ToolGrant,
    WorkspaceToolFamily,
} from "./tools.contracts"
import type { ToolsOptions } from "./tools.options"
import type { OptionalRightSeen } from "./right-origin.contracts"
import { NativeRunnerService } from "./native-runner.service"
import { addressOf, grantFor, namedToolIn, toolNameOf } from "./tool-name.policy"
import type { NodeStepRef } from "@modules/domain/graph-nodes"

/** A resolved call: the connector, the spec and the full name. */
interface Resolved {
    /** The connector. */
    readonly connector: WorkspaceToolFamily
    /** The tool spec. */
    readonly spec: ManifestTool
    /** The full name. */
    readonly name: string
    /** For a tool answered per provider, once judged: the parts the caller may see. */
    readonly parts?: ReadonlyArray<ProviderPart>
}

/**
 * What the rights decide about one call before anything runs: it stops (refused or waiting for a person, with its audit line and its
 * answer), or it goes, and for a tool answered per provider with the parts the caller may see.
 */
type Decision =
    | {
          readonly kind: "stop"
          readonly outcome: CallOutcome
          readonly code: string
          readonly summary: string
          readonly result: ToolCallResult
      }
    | { readonly kind: "go"; readonly parts?: ReadonlyArray<ProviderPart> }

/** A decision that stops the call. */
type Stop = Extract<Decision, { readonly kind: "stop" }>

/** The stop of a refused right (`not_attached`, `node_mode_unknown`): the reason in the audit, the call `not_granted` with it. */
const refusalStop = (reason: string): Stop => ({
    kind: "stop",
    outcome: "refused",
    code: reason,
    summary: "",
    result: { ok: false, code: "not_granted", detail: reason },
})

/** The stop a grant verdict makes (refused, or waiting for a person), or null when it lets the call through. */
const grantStop = (verdict: GrantVerdict, name: string): Decision | null => {
    if (verdict.kind === "refuse") {
        return {
            kind: "stop",
            outcome: "refused",
            code: "not_granted",
            summary: "",
            result: { ok: false, code: "not_granted", detail: name },
        }
    }
    if (verdict.kind === "approval") {
        return {
            kind: "stop",
            outcome: "approval",
            code: verdict.reason,
            summary: "",
            result: { ok: false, code: "approval_required", reason: verdict.reason },
        }
    }
    return null
}

/** The stop of a tool answered per provider with no part to judge: its call names a provider it has no part for. */
const noPartStop = (name: string): Decision => ({
    kind: "stop",
    outcome: "refused",
    code: "not_granted",
    summary: "",
    result: { ok: false, code: "not_granted", detail: name },
})

/** One part of a tool answered per provider, as judged. */
interface JudgedPart {
    /** The provider of the part. */
    readonly provider: string
    /** What its rights decided. */
    readonly decision: Decision
}

/** The stable client intent and the schema-dependent payload of one connector call. */
interface GatewayArguments {
    /** The caller's arguments before the registry adds the tool's replay field. */
    readonly original: ToolJson
    /** The arguments authorized, audited and sent under the current approved schema. */
    readonly forwarded: ToolJson
}

/** What running the adapter came to. */
type Ran =
    | { readonly kind: "ok"; readonly value: ToolJson }
    | {
          readonly kind: "tool_error"
          readonly value: ToolJson
          /** The reason of a native refusal its source classed `business`; absent for every other tool error. */
          readonly refused?: string
          /** The typed reason of a native refusal, whatever its class; absent for any other tool error. */
          readonly nativeRefusal?: string
      }
    | {
          readonly kind: "failed"
          readonly outcome: "timeout" | "error"
          readonly code: string
          /** What the adapter proved about the effect where it failed, or null when it typed nothing. */
          readonly proof: ProviderCallProof | null
      }

/**
 * Where a caller is told what a failed call proves about its effect (`providerCallFailure`, or a write's timeout: `unknown`): the tool
 * runner reads it to decide a fallback. Nothing else reads it, and it is never part of the answer.
 */
export interface ToolProofSink {
    /** What the failure proves, or null when it proves nothing (or the call did not fail). */
    proof: ProviderCallProof | null
}

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
    /** The truths a truth-graph read served (`readsTruths` tools), or absent. */
    readonly reads?: ReadonlyArray<TruthRead>
    /** The records an `ok` call touched, as its adapter stated them, or absent (no count stated). */
    readonly records?: StatedRecords
}

/** What the receipt of arguments refused by the generic bound records: the refused tree is unbounded, so it is never serialized. */
const UNRECORDED_ARGUMENTS: ToolJson = {}

/**
 * The code of the audit line of a write the durable receipt answered: the same step asked the same call again (a step run again, the
 * engine's replay of an approved call on a later run) and was handed the FIRST answer; nothing was executed a second time.
 */
export const RECEIPT_REPLAY = "receipt_replay"

/** The kind of the answer a ledgered tool gives when it refused the call (a fact, never a failure). */
const REFUSED_KIND = "refused"

/**
 * The reason of a refusal an answer carries, for the audit line: a ledgered tool's refusal answer, or the outside system's own refusal
 * of an operation (`outsideRefusalOf`, a business answer); null for any other answer.
 */
const refusalCodeOf = (spec: ManifestTool, value: ToolJson): string | null =>
    spec.ledgered === true && value.kind === REFUSED_KIND && typeof value.id === "string"
        ? value.id
        : (outsideRefusalOf(value)?.code ?? null)

/**
 * Where a caller's call came from: the road it stated and its workflow step, or undefined for a caller that stated neither.
 */
const seenOf = (caller: ToolCaller): OptionalRightSeen => {
    if (caller.origin === undefined && caller.node === undefined) return undefined
    return {
        origin: caller.origin ?? "unstated",
        ...(caller.node === undefined ? {} : { node: caller.node }),
        ...(caller.triggerRole === undefined ? {} : { triggerRole: caller.triggerRole }),
    }
}

/** Where a call's mode comes from, and that source. */
interface Road {
    readonly kind: "step" | "engine" | "outside"
    readonly source: Awaited<ReturnType<typeof modeSourceOf>>
}

/** The answer of a call that stops before any connector is reached. */
const failure = (code: "invalid_name" | "unknown_tool", detail: string): ToolCallResult => ({
    ok: false,
    code,
    detail,
})

/**
 * True when a timed-out write carries a nonblank string replay key, so the server can return its stored result instead of acting twice.
 */
const replayable = (spec: ManifestTool, args: ToolJson, ran: Ran): boolean => {
    if (
        ran.kind !== "failed" ||
        (ran.outcome !== "timeout" && ran.proof !== "unknown") ||
        spec.scope === "read" ||
        spec.idempotencyArg === undefined
    )
        return false
    const key = args[spec.idempotencyArg]
    return typeof key === "string" && key.trim() !== ""
}

@Injectable()
/**
 * The engine's tool registry: every tool family registered in code (the engine's own and the provider adapters'), and the one judged
 * call of a tool. Every call goes the same way: the name, the family, the rights (nivo-frame `rights`: the step's node declared the
 * tool, the agent is attached to an account of a provider serving it, then the node's declared mode; a grant row only lists what a road
 * outside every node may read), the family's circuit breaker (per workspace and family, so one slow family never stalls
 * another), the code under the family's time limit, and one masked audit line. A failure is an answer (`unavailable`), never a throw;
 * the registry never claims a result the code did not give. A side-effect call carries a replay key derived from its step, so a retry
 * never acts twice. NIVO calls no MCP server: the outbound mcp app is a surface over this same registry.
 */
export class ToolRegistryService {
    private readonly breakers = new Map<string, BreakerState>()
    /** The turns that read text a stranger may have written, and when (per process, like the breakers). */
    private tainted: ReadonlyMap<string, number> = new Map()

    constructor(
        @InjectToolsOptions() private readonly options: ToolsOptions,
        @InjectNativeToolFamilies() private readonly natives: ReadonlyArray<NativeToolFamily>,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly grants: ToolGrantsService,
        private readonly callLog: ToolCallLogService,
        private readonly receipts: ToolReceiptsService,
        private readonly nativeRunner: NativeRunnerService,
        @Optional() private readonly accounts?: AgentAccountsService,
        @Optional() @InjectNodeRequestsGate() private readonly nodeRequests: NodeRequestsGate | null = null,
    ) {}

    /** The tool families every workspace runs: the ones registered in code, each under its time limit. */
    familiesOf(): ReadonlyArray<WorkspaceToolFamily> {
        return this.natives.map((adapter) => toolFamilyOf(adapter, this.options.defaultTimeoutMs))
    }

    /** The grants of one agent. */
    async grantsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ToolGrant>> {
        return (await this.grants.listOfAgent(workspaceId, agentId)).flatMap((row) => {
            const grant = grantOf(row)
            return grant === null ? [] : [grant]
        })
    }

    /**
     * The agents of a workspace that may call any of the tools (full names or `connector.*`): those attached to an account serving one,
     * then those holding a grant row of one, oldest grant first.
     */
    async agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const [holding, granted] = await Promise.all([
            this.accounts?.agentsHolding(workspaceId, tools) ?? [],
            this.grants.agentsGranted(workspaceId, tools),
        ])
        return [...new Set([...holding, ...granted])]
    }

    /**
     * Calls one tool through its schema, grant, approval and breaker; non-read tools require a nonblank operation key or work item.
     * `proved`, when given, is told what a failure of the adapter proves about the call's effect (the tool runner's fallback).
     */
    async call(caller: ToolCaller, name: string, args: ToolJson, proved?: ToolProofSink): Promise<ToolCallResult> {
        const started = this.clock.now().getTime()
        const parsed = toolArgumentsSchema.safeParse(args)
        const resolved = this.resolve(name)
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
        const decided = isProviderParted(resolved.name)
            ? await this.partsDecisionOf(caller, resolved, sent)
            : await this.decisionOf(caller, resolved)
        if (decided.kind === "stop") {
            await this.audit(caller, resolved, sent, {
                outcome: decided.outcome,
                code: decided.code,
                summary: decided.summary,
                started,
            })
            return decided.result
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
        const result = await this.guarded(
            caller,
            decided.parts === undefined ? resolved : { ...resolved, parts: decided.parts },
            { original: args, forwarded: sent },
            started,
            proved,
        )
        // The shape of the answer is said by the connector's manifest (in code), after the receipt: a replayed answer is marked alike.
        const { answers } = resolved.connector.manifest
        return result.ok && answers !== undefined ? { ...result, answers } : result
    }

    /**
     * The decision of one call of a tool (nivo-frame `rights`): the road, the step's allow-list and the node's mode (`grantDecisionOf`);
     * then, for a tool a provider serves, the agent's attachment to an account of one (`not_attached` otherwise: the kill switch, which
     * wins over an ask); then the mode's ask, if any.
     */
    private async decisionOf(caller: ToolCaller, resolved: Resolved): Promise<Decision> {
        const verdict = await this.grantDecisionOf(caller, resolved)
        if (verdict.kind === "stop") return verdict
        if (verdict.kind === "refuse") return grantStop(verdict, resolved.name) ?? noPartStop(resolved.name)
        const attached = await this.attachmentOf(caller, resolved)
        if (attached?.kind === "refuse") return refusalStop(attached.reason)
        return grantStop(verdict, resolved.name) ?? { kind: "go" }
    }

    /**
     * The decision of one call of a tool answered per provider (`nivo.tool.connection.status.get`): the road, the allow-list and the mode
     * once, then each part (the provider the call names, else every provider the tool has a part for) on the agent's attachment to an
     * account of that provider when the provider serves the tool (a part of a provider that does not serve it needs none). The call goes
     * with the parts that passed; when none passed it stops as the first part that asks a person stops, else as the first part refused.
     */
    private async partsDecisionOf(caller: ToolCaller, resolved: Resolved, sent: ToolJson): Promise<Decision> {
        const named = typeof sent.provider === "string" ? sent.provider : undefined
        const providers = (resolved.spec.providerParts ?? []).filter(
            (provider) => named === undefined || provider === named,
        )
        const grant = await this.grantDecisionOf(caller, resolved)
        if (grant.kind === "stop") return grant
        if (grant.kind === "refuse") return grantStop(grant, resolved.name) ?? noPartStop(resolved.name)
        const judged = await Promise.all(
            providers.map(async (provider): Promise<JudgedPart> => {
                const attached = await this.attachmentOf(caller, resolved, { provider })
                if (attached?.kind === "refuse") return { provider, decision: refusalStop(attached.reason) }
                return { provider, decision: grantStop(grant, resolved.name) ?? { kind: "go" } }
            }),
        )
        const parts = judged.flatMap(({ provider, decision }): ReadonlyArray<ProviderPart> =>
            decision.kind === "go" ? [{ provider }] : [],
        )
        if (parts.length > 0) return { kind: "go", parts }
        const stops = judged.map((entry) => entry.decision)
        const asking = stops.find((decision) => decision.kind === "stop" && decision.outcome === "approval")
        return asking ?? stops[0] ?? noPartStop(resolved.name)
    }

    /**
     * THE KILL SWITCH of a call (nivo-frame `rights`): the agent's attachment to an account of a provider serving the tool, judged on the
     * account the ToolRunner handed the call (an attachment to another account says nothing), else on the part's provider, else on any
     * serving attachment; null when no provider serves the tool (or a provider-bound tool names no provider: its executor asks) or no
     * reader of the accounts is bound. The engine's own caller is judged alike: its job runs once attached.
     */
    private attachmentOf(caller: ToolCaller, resolved: Resolved, named?: AccountTarget): Promise<AttachmentVerdict | null> {
        if (this.accounts === undefined) return Promise.resolve(null)
        const target: AccountTarget =
            caller.connectionId === undefined
                ? (named ?? {})
                : { connectionId: caller.connectionId, ...(caller.provider === undefined ? {} : { provider: caller.provider }) }
        return this.accounts.attachmentOf(caller.workspaceId, caller.agentId, resolved.name, target)
    }

    /** The mode of a call: where it comes from (a workflow step's node, the engine, a road outside every node) and its verdict. */
    private async modeOf(caller: ToolCaller, resolved: Resolved): Promise<{ readonly road: Road; readonly mode: ModeVerdict }> {
        const road = await this.roadOf(caller)
        const mutates = resolved.spec.scope !== "read"
        return { road, mode: modeVerdictOf({ mutates, approved: caller.approvedBy !== undefined, source: road.source }) }
    }

    /** Where a caller's mode comes from: the step's pinned node (read through the node requests reader), the engine, or outside. */
    private async roadOf(caller: ToolCaller): Promise<Road> {
        const read = (step: NodeStepRef) =>
            this.nodeRequests === null ? Promise.resolve(null) : this.nodeRequests.requestOf(caller.workspaceId, caller.agentId, step)
        const source = await modeSourceOf(seenOf(caller), caller.engine === true, read)
        return { kind: source.kind, source }
    }

    /**
     * The verdict of the road, the allow-list and the mode (nivo-frame `rights`): a step's call must be on its node's allow-list (or a
     * step default) and runs in its node's mode (a read never asks); the engine's own call runs; a road outside every node may read what a
     * grant row (or a default read) lists, and a write there asks (`outside_write`). A node with no readable mode refuses
     * (`node_mode_unknown`).
     */
    private async grantDecisionOf(caller: ToolCaller, resolved: Resolved): Promise<GrantVerdict | Stop> {
        const { road, mode } = await this.modeOf(caller, resolved)
        if (mode.kind === "refuse") return refusalStop(mode.reason)
        const row = road.kind === "outside" ? grantFor(await this.grantsOf(caller.workspaceId, caller.agentId), resolved.name) : null
        return grantVerdictOf(row, resolved.spec, caller, resolved.name, mode, road.kind)
    }

    /**
     * True for a write of a turn that read tainted text, unless a person approved this exact call: the grant alone does not carry it. A
     * write that only files a request a person decides (`filesRequest`) is never held: that person reads it before anything changes.
     */
    private mustAsk(caller: ToolCaller, resolved: Resolved): boolean {
        return (
            seenOf(caller)?.node === undefined &&
            resolved.spec.scope !== "read" &&
            resolved.spec.taintExempt !== true &&
            resolved.spec.filesRequest !== true &&
            caller.approvedBy === undefined &&
            isTainted(this.tainted, caller, this.clock.now().getTime())
        )
    }

    /** Refuses invalid arguments, with a receipt when the tool resolves (an unknown tool has no connector to file it under). */
    private async refuseArguments(
        caller: ToolCaller,
        resolved: Resolved | ToolCallResult,
        args: ToolJson,
        started: number,
    ): Promise<ToolCallResult> {
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
        caller: ToolCaller,
        resolved: Resolved,
        args: GatewayArguments,
        started: number,
        proved?: ToolProofSink,
    ): Promise<ToolCallResult> {
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
        if (resolved.spec.scope === "read" || resolved.spec.ledgered === true || !gate.allowed) {
            return this.execute(caller, resolved, args.forwarded, started, proved)
        }
        const key = createHash("sha256")
            .update(JSON.stringify([caller.workspaceId, step, resolved.name, argsHashOf(args.original)]))
            .digest("hex")
        let executed = false
        const operation: ToolReceiptOperation = () => {
            executed = true
            return this.execute(caller, resolved, args.forwarded, started, proved)
        }
        const result = await this.receipts.run(caller.workspaceId, key, operation)
        // A call the receipt answered ran nothing now: it is audited as such, so a step run again still leaves its line.
        if (!executed) {
            await this.audit(caller, resolved, args.forwarded, {
                outcome: result.ok ? "ok" : "error",
                code: RECEIPT_REPLAY,
                summary: result.ok ? (result.summary ?? "") : "",
                started,
            })
        }
        return result
    }

    /** Invokes the connector only for a live read or the winner of a durable write claim. */
    private async execute(
        caller: ToolCaller,
        resolved: Resolved,
        args: ToolJson,
        started: number,
        proved?: ToolProofSink,
    ): Promise<ToolCallResult> {
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
        if (proved !== undefined && ran.kind === "failed") {
            proved.proof = ran.proof ?? (ran.outcome === "timeout" && resolved.spec.scope !== "read" ? "unknown" : null)
        }
        return this.answer(caller, resolved, args, ran, started)
    }

    private async answer(
        caller: ToolCaller,
        resolved: Resolved,
        args: ToolJson,
        ran: Ran,
        started: number,
    ): Promise<ToolCallResult> {
        if (ran.kind === "failed") {
            const unknown = (ran.outcome === "timeout" || ran.proof === "unknown") && resolved.spec.scope !== "read"
            const code = unknown ? "unknown_outcome" : ran.code
            await this.audit(caller, resolved, args, { outcome: ran.outcome, code, summary: "", started })
            return { ok: false, code: unknown ? "unknown_outcome" : "unavailable", detail: ran.code }
        }
        const shown = ran.value
        const summary = summaryOf(shown, resolved.spec.secretFields)
        if (ran.kind === "tool_error") {
            // A refusal its source classed business is audited as what it is (refused, by its reason); any other tool error as an error.
            const typed = ran.nativeRefusal === undefined ? {} : { nativeRefusal: ran.nativeRefusal }
            if (ran.refused !== undefined) {
                await this.audit(caller, resolved, args, { outcome: "refused", code: ran.refused, summary, started })
                return { ok: false, code: "tool_error", detail: summary, refused: ran.refused, ...typed }
            }
            await this.audit(caller, resolved, args, { outcome: "error", code: "tool_error", summary, started })
            return { ok: false, code: "tool_error", detail: summary, ...typed }
        }
        const refused = refusalCodeOf(resolved.spec, shown)
        await this.audit(caller, resolved, args, {
            outcome: refused === null ? "ok" : "refused",
            code: refused,
            summary,
            started,
            ...(resolved.spec.readsTruths === true ? { reads: truthReadsOf(shown) } : {}),
            ...(refused === null ? { records: statedRecordsOf(resolved.spec.scope, ran.value) } : {}),
        })
        if (resolved.spec.taints === true) this.tainted = withTaint(this.tainted, caller, this.clock.now().getTime())
        return { ok: true, value: shown, summary }
    }

    /** The family and spec of a full name, or the failure that stops the call before any right is read. */
    private resolve(name: string): Resolved | ToolCallResult {
        if (addressOf(name) === null) return failure("invalid_name", name)
        const found = namedToolIn(this.familiesOf(), name)
        if (found === null) return failure("unknown_tool", name)
        const { connector, spec } = found
        return { connector, spec, name: toolNameOf(connector.manifest, spec.name) }
    }

    /** Runs the family's code under its time limit; every failure is an answer. */
    private async run(caller: ToolCaller, resolved: Resolved, args: ToolJson): Promise<Ran> {
        const { workspaceId } = caller
        const { connector, spec } = resolved
        const adapter = this.natives.find((entry) => entry.manifest.key === connector.manifest.key)
        try {
            if (adapter === undefined)
                throw new ToolsError({ code: ToolsErrorCode.UnknownTool, params: { tool: resolved.name } })
            return resolved.parts === undefined
                ? await this.nativeRunner.run(adapter, caller, spec.name, connector.timeoutMs, args)
                : await this.nativeRunner.run(adapter, caller, spec.name, connector.timeoutMs, args, resolved.parts)
        } catch (cause) {
            this.logger.error(ToolsLogEvent.CallFailed, cause, {
                workspaceId,
                connector: connector.manifest.key,
                tool: spec.name,
            })
            return {
                kind: "failed",
                outcome: isTimeout(cause) ? "timeout" : "error",
                code: failureCodeOf(providerCallCause(cause)),
                proof: proofOf(cause),
            }
        }
    }

    private async audit(caller: ToolCaller, resolved: Resolved, args: ToolJson, line: AuditLine): Promise<void> {
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
            runId: caller.turnId ?? null,
            factReads: line.reads ?? null,
            originKind: caller.origin ?? null,
            nodeKey: caller.node?.nodeKey ?? null,
            workflowId: caller.node?.workflowId ?? null,
            workflowVersionId: caller.node?.versionId ?? null,
            recordsRead: line.records?.read ?? null,
            recordsChanged: line.records?.changed ?? null,
            connectionId: caller.connectionId ?? null,
            provider: caller.provider ?? null,
            attempt: caller.attempt ?? null,
            chosenBy: caller.chosenBy ?? null,
        })
    }
}
