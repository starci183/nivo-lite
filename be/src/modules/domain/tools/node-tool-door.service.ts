import { Injectable, Optional } from "@nestjs/common"
import {
    GraphNodeEffectsService,
    GraphNodeRegistryService,
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
    type NodeEffectRightCall,
    type NodeRunClaims,
    type NodeToolAccount,
    type NodeToolAnswer,
    type NodeToolCall,
    type NodeToolDoor,
    type NodeToolRun,
} from "@modules/domain/graph-nodes"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { AgentViewScopeService } from "@modules/domain/agents"
import { lockedArgumentsOf } from "./locked-arguments.policy"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { InjectClock, SystemClockService, type Clock } from "@modules/platform/clock"
import { InjectConversationLeadsGate } from "./tools.decorators"
import type { ConversationLeadsGate } from "./tools.contracts"
import { ToolRunnerService } from "./tool-runner.service"
import { audienceOfModule } from "./caller-audience.policy"
import { callWordsOf } from "./tool-call.policy"
import { approvalContentOf } from "./approval-content.policy"
import { toolSpecOf } from "@modules/domain/tool-specs"
import { toolArgumentsSchema } from "./tool-arguments.schema"
import { runOfClaims, type StepClaims } from "./tool-run.policy"
import type { ToolCallResult, ToolCaller } from "./tools.contracts"
import type { ToolProofSink } from "./tool-registry.service"
import { ToolsLogEvent } from "./tools.log-events"
import { ToolRegistryService } from "./tool-registry.service"
import { isChannelBound, isProviderTool, type RightVerdict } from "./provider-abilities.policy"
import type { NodeStepRef } from "@modules/domain/graph-nodes"
import { AgentAccountsService } from "./agent-accounts.service"
import { seenAtStep } from "./node-rule.policy"
import { refusedOf, templateValueOf } from "./node-tool-answer.policy"
import { InjectNodeRequestsGate } from "./node-requests.decorators"
import { modeSourceOf, modeVerdictOf, type NodeRequestsGate, type OptionalNodeRequest } from "./node-mode.policy"

/** A subject the door resolved, or null when it found none. */
export type OptionalSubjectRef = SubjectRef | null

/** The typed reason a native tool refuses with when the workspace has no connected provider for it (the call was never sent). */
const NOT_CONNECTED = "not_connected"

/** The typed reason a native tool refuses with when the provider refused the workspace's connection: only the owner can cure it. */
const CONNECTION_REFUSED = "connection_refused"

/** The most governing seats read to judge the member behind a turn. */
const STEWARDS_MAX = 50

/**
 * The arguments of a call a person is asked to approve, in plain words (bounded names and values, at most the card's count), so the
 * permission request can show them, as one JSON text (error params are texts or numbers); the raw payload never rides the error.
 */
const askedArgsOf = (args: unknown): string =>
    JSON.stringify(Object.fromEntries(callWordsOf(args).map((word) => [word.name, word.value])))

/**
 * The content of a call a person approves, in full, as the one param an approval error carries it in (JSON text: error params are texts
 * or numbers): the members its tool's declaration marks (`approvalContent`), or nothing when it marks none.
 */
const contentParamsOf = (tool: string, args: unknown): Readonly<Record<string, string>> => {
    const members = toolSpecOf(tool)?.approvalContent ?? []
    const content = approvalContentOf(args, members)
    return content.length === 0 ? {} : { content: JSON.stringify(content) }
}

/**
 * The exact call a person is asked to approve, so the engine can run THAT call once the person approved it, through this door under
 * the same key, instead of asking the model to issue it again (a model asked again rewrites its words, and an approval is bound to the
 * exact arguments): `call` is the JSON text of the arguments as the node host checked them, `key` the call's replay key. Error params
 * are texts or numbers; the approval error is never logged by this door (`failed` is not called for it).
 */
interface AskedCall {
    /** The arguments as the host passed them. */
    readonly args: unknown
    /** The call's replay key. */
    readonly key: string
    /** The account the runner handed the call, when one. */
    readonly account?: NodeToolAccount | undefined
}

/** The params an ask names the account in, when the runner handed the call one: the approval then covers that account alone. */
const accountParamsOf = (account: NodeToolAccount | undefined): Readonly<Record<string, string>> =>
    account === undefined ? {} : { connectionId: account.connectionId, provider: account.provider }

/** The typed error of a gateway answer that is not a value; a failure carries what the adapter proved about it (`proof`), when it did. */
const failureOf = (
    tool: string,
    fingerprint: string,
    result: Exclude<ToolCallResult, { ok: true }>,
    asked: AskedCall,
    proved: ToolProofSink,
): GraphNodesError => {
    if (result.code === "approval_required") {
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: {
                tool,
                fingerprint,
                reason: result.reason,
                args: askedArgsOf(asked.args),
                call: JSON.stringify(asked.args) ?? "{}",
                key: asked.key,
                ...contentParamsOf(tool, asked.args),
                ...accountParamsOf(asked.account),
            },
        })
    }
    if (result.code === "not_granted")
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolNotGranted,
            params: { tool, reason: result.detail === tool ? "no_tool_grant" : result.detail },
        })
    // "Never sent" is the TYPED reason of the native refusal the gateway carries (`nativeRefusal`), never a word of the detail: a
    // family's text that names one of these reasons is an ordinary failure.
    if (result.code === "tool_error" && result.nativeRefusal === NOT_CONNECTED)
        return new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool } })
    if (result.code === "tool_error" && result.nativeRefusal === CONNECTION_REFUSED)
        return new GraphNodesError({ code: GraphNodesErrorCode.ToolConnectionRefused, params: { tool } })
    return new GraphNodesError({
        code: GraphNodesErrorCode.ToolFailed,
        params: { tool, reason: result.code, ...(proved.proof === null ? {} : { proof: proved.proof }) },
    })
}

@Injectable()
/**
 * The door every node tool call goes through: the engine tools registry. Who calls is the run token the host minted (workspace, agent, run,
 * who the run acts for, what it may read), never what a node says: a call without a valid token is refused. What is allowed is the
 * intersection, default deny: the agent's grant per tool and its limits (the gateway), the member behind the turn (an owner or manager
 * seat; any other member's turn calls nothing unless a person approved it), the turn's scope (a customer's turn calls as the customer
 * audience, public knowledge only), and the provider's consent on the workspace connection (the provider answers it). A grant that asks
 * a person is the typed `GRAPH_NODES_TOOL_APPROVAL_REQUIRED` with the fingerprint of the exact tool and arguments, and the exact call
 * (its arguments and key), which the engine runs through this door once the person approved it; a call that replays an approval of that
 * fingerprint runs as approved, and changed arguments ask again. The node passes business data only: the destination,
 * the accounts and the credentials live on the workspace connection. The call key is the replay key of the step. Every refusal and failure
 * other than an approval to ask is logged with its typed code, the gateway code and the reason (`tools.node-tool.failed`), so a node
 * that survives the failure (a payment request that tells the owner instead) never hides why.
 */
export class NodeToolDoorService implements NodeToolDoor {
    constructor(
        private readonly gateway: ToolRegistryService,
        private readonly tokens: GraphNodeRunTokensService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly members?: WorkspaceMembersReadService,
        @Optional() private readonly scopes?: AgentViewScopeService,
        @Optional() private readonly accounts?: AgentAccountsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly routes?: CustomerRoutesService,
        @Optional() private readonly ledger?: GraphNodeEffectsService,
        @Optional() private readonly callLog?: ToolCallLogService,
        @Optional() @InjectConversationLeadsGate() private readonly leads?: ConversationLeadsGate,
        @Optional() @InjectClock() private readonly clock?: Clock,
        @Optional() @InjectNodeRequestsGate() private readonly nodeRequests?: NodeRequestsGate | null,
    ) {
        this.runner = this.runnerOf()
    }

    /** The one runner of this door's calls, or null in an app that binds no effect ledger or registry (it then runs no effect). */
    private readonly runner: ToolRunnerService | null

    /**
     * Runs one call of a node through the ONE runner: an effect (rights, the run's pin, the step's receipts, the ledger, the executor,
     * the audit line) or a tool (this door's `call`).
     */
    run(call: NodeToolRun): Promise<NodeToolAnswer> {
        if (this.runner === null) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind: "tool-runner" } })
        }
        return this.runner.run(call)
    }

    private runnerOf(): ToolRunnerService | null {
        const { registry, ledger, routes } = this
        if (registry === undefined || ledger === undefined) return null
        const leads: ConversationLeadsGate | null =
            this.leads ??
            (routes === undefined
                ? null
                : { leadOf: async (workspaceId, conversationId) => (await routes.get(workspaceId, conversationId))?.contactId ?? null })
        return new ToolRunnerService({
            door: {
                call: (call) => this.call(call),
                effectRight: (call) => this.effectRight(call),
            },
            registry,
            ledger,
            accounts: this.accounts,
            leads,
            audit: this.callLog,
            clock: this.clock ?? new SystemClockService(),
            logger: this.logger,
        })
    }

    /**
     * The right of the run's agent to perform an effect through `context.effect` (nivo-frame `rights`), as the gateway judges a tool, so
     * the two roads cannot disagree: an effect a provider serves needs the agent's ATTACHMENT to an account serving it (the account the
     * runner handed, else any serving one: `not_attached` is the kill switch); then the step's declared mode decides (`auto` runs, `ask`
     * is the typed approval error with the fingerprint of the effect and its payload, unless the call replays an approval of that
     * fingerprint). An effect of NIVO's own (no account) follows the step's mode alone. A channel-bound effect (the customer send) follows
     * the step's mode alone here too, so a send under `ask` raises the same approval as every other tool (rights rule 11) and the approved
     * call is replayed once; the account the person is reached through is known only to its executor, which judges the attachment to it
     * (the kill switch). A refusal of the setup (not attached, no readable mode) is on the `defineNode`
     * road the refusal fact, on the template road (`refusals: "answer"`) the typed `GRAPH_NODES_TOOL_NOT_GRANTED`, which freezes the step.
     * A call with no workflow step is the engine's own and runs once attached.
     */
    async effectRight(call: NodeEffectRightCall): Promise<OptionalSubjectRef> {
        const channelBound = isChannelBound(call.effect)
        const provided = isProviderTool(call.effect)
        // An app that binds no reader of the accounts judges no provider effect here (as the gateway with no accounts bound).
        if (provided && !channelBound && this.accounts === undefined) return null
        const claims = this.tokens.verify(call.token)
        if (claims === null) {
            throw this.failed(
                call.effect,
                null,
                new GraphNodesError({ code: GraphNodesErrorCode.ToolTokenInvalid, params: { tool: call.effect } }),
            )
        }
        const fingerprint = toolFingerprintOf(call.effect, call.payload, call.account?.connectionId)
        const approved = call.approval?.fingerprint === fingerprint
        if (channelBound || !provided || this.accounts === undefined) return this.ownRight(call, claims, fingerprint, approved)
        // The account the runner handed the effect is the one it is judged on.
        const target =
            call.account === undefined ? {} : { provider: call.account.provider, connectionId: call.account.connectionId }
        const attached = await this.accounts.attachmentOf(claims.workspaceId, claims.agentId, call.effect, target)
        if (attached === null) return this.ownRight(call, claims, fingerprint, approved)
        const verdict: RightVerdict =
            attached.kind === "refuse" ? attached : await this.modeOnAccount(claims, approved, attached)
        // The verdict of an effect is filed in the audit here, where it is produced: the gateway never sees an effect.
        await this.accounts.effectJudged({
            workspaceId: claims.workspaceId,
            agentId: claims.agentId,
            effect: call.effect,
            verdict,
            seen: claims.step === undefined ? undefined : seenAtStep("node", claims.step),
            runId: claims.runId,
            conversationId: claims.conversationId,
            approvedBy: approved ? (call.approval?.by ?? null) : null,
        })
        if (verdict.kind === "allow") return null
        if (verdict.kind === "approval") throw this.askOf(call, fingerprint)
        return this.refusedRight(call, claims, verdict.reason, { tool: call.effect, providers: [...verdict.providers] })
    }

    /** The step's declared mode over an effect on the account it is attached to (an effect always writes). */
    private async modeOnAccount(
        claims: StepClaims,
        approved: boolean,
        attached: Extract<RightVerdict, { readonly kind: "allow" }>,
    ): Promise<RightVerdict> {
        const seen = claims.step === undefined ? undefined : seenAtStep("node", claims.step)
        const source = await modeSourceOf(seen, seen === undefined, (step) => this.stepRequestOf(claims, step))
        const mode = modeVerdictOf({ mutates: true, approved, source })
        if (mode.kind === "run") return attached
        if (mode.kind === "ask") return { ...attached, kind: "approval" }
        return { kind: "refuse", reason: mode.reason, providers: [attached.provider], connectionId: attached.connectionId }
    }

    /**
     * An effect judged by the step's declared mode alone (`modeVerdictOf`; an effect always writes): one of NIVO's own (no account), a
     * provider effect whose agent has no attachment to read, or the customer send (its executor judges the account).
     */
    private async ownRight(
        call: NodeEffectRightCall,
        claims: StepClaims,
        fingerprint: string,
        approved: boolean,
    ): Promise<OptionalSubjectRef> {
        const seen = claims.step === undefined ? undefined : seenAtStep("node", claims.step)
        const source = await modeSourceOf(seen, seen === undefined, (step) => this.stepRequestOf(claims, step))
        const verdict = modeVerdictOf({ mutates: true, approved, source })
        if (verdict.kind === "run") return null
        if (verdict.kind === "ask") throw this.askOf(call, fingerprint)
        return this.refusedRight(call, claims, verdict.reason, { tool: call.effect })
    }

    /** The typed approval error of an effect: its fingerprint, the reason `ask_mode`, its arguments in words and the account handed. */
    private askOf(call: NodeEffectRightCall, fingerprint: string): GraphNodesError {
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: {
                tool: call.effect,
                fingerprint,
                reason: "ask_mode",
                args: askedArgsOf(call.payload),
                ...contentParamsOf(call.effect, call.payload),
                ...accountParamsOf(call.account),
            },
        })
    }

    /**
     * A refusal of the setup (`not_attached`, `node_mode_unknown`), logged: the template road throws the typed rights
     * refusal (it freezes the step and is reported); the `defineNode` road reads it as the refusal fact.
     */
    private refusedRight(
        call: NodeEffectRightCall,
        claims: StepClaims,
        reason: string,
        facts: Readonly<Record<string, string | ReadonlyArray<string>>>,
    ): SubjectRef {
        const refused = this.failed(
            call.effect,
            claims,
            new GraphNodesError({ code: GraphNodesErrorCode.ToolNotGranted, params: { tool: call.effect, reason } }),
        )
        if (call.refusals === "answer") throw refused
        return { kind: "refused", id: reason, facts }
    }

    /** The request of a step's pinned node, or null (no reader, nothing readable): the mode then refuses (there is no default). */
    private async stepRequestOf(claims: StepClaims, step: NodeStepRef): Promise<OptionalNodeRequest> {
        if (this.nodeRequests === undefined || this.nodeRequests === null) return null
        return this.nodeRequests.requestOf(claims.workspaceId, claims.agentId, step)
    }

    /** Calls the tool for the run its token names and answers its value. */
    async call(call: NodeToolCall): Promise<unknown> {
        const claims = this.tokens.verify(call.token)
        if (claims === null) {
            throw this.failed(
                call.tool,
                null,
                new GraphNodesError({ code: GraphNodesErrorCode.ToolTokenInvalid, params: { tool: call.tool } }),
            )
        }
        const checked = toolArgumentsSchema.safeParse(call.args)
        if (!checked.success) {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolFailed,
                    params: { tool: call.tool, reason: "invalid_arguments" },
                }),
            )
        }
        const locked = lockedArgumentsOf(call.tool, claims, checked.data)
        if (locked.kind === "refused") {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolNotGranted,
                    params: { tool: call.tool, reason: locked.reason },
                }),
            )
        }
        const fingerprint = toolFingerprintOf(call.tool, checked.data, call.account?.connectionId)
        const approvedBy = call.approval?.fingerprint === fingerprint ? call.approval.by : undefined
        if (approvedBy === undefined && !(await this.memberMayCall(claims))) {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolFailed,
                    params: { tool: call.tool, reason: "member_not_allowed" },
                }),
            )
        }
        const caller = await this.callerOf(claims, call.key, approvedBy, call.account)
        // What a failure proves is asked only of a call on an account the runner handed (its fallback reads it).
        const proved: ToolProofSink = { proof: null }
        const result =
            call.account === undefined
                ? await this.gateway.call(caller, call.tool, locked.args)
                : await this.gateway.call(caller, call.tool, locked.args, proved)
        if (result.ok) {
            if (call.refusals !== "answer") return result.value
            // The template road: an outside refusal is the refusal fact, an OpenAPI success the node's answer (body + meta).
            const answered = templateValueOf(call.tool, result, call.account)
            if (answered.kind === "value") return answered.value
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool: call.tool, reason: "answer_unreadable" } }),
            )
        }
        const error = failureOf(call.tool, fingerprint, result, { args: checked.data, key: call.key, account: call.account }, proved)
        // A refusal its source classed business is the answer of a call that asks for refusals as answers (the template road); it is
        // still logged like every refusal. Everything else (not connected, a refused connection, a failure) is thrown as before.
        if (call.refusals === "answer" && result.code === "tool_error" && result.refused !== undefined) {
            this.failed(call.tool, claims, error, result.code)
            return refusedOf(call.tool, result.refused, {})
        }
        if (error.code === GraphNodesErrorCode.ToolApprovalRequired) throw error
        throw this.failed(call.tool, claims, error, result.code)
    }

    /**
     * Who the step's agent talks to. A run for the workspace is internal. A run a customer started is the customer's unless its agent
     * belongs to an internal module (the accounting step of a run the front desk started): then the agent's own audience holds, read
     * from its module under the catalogue's default deny; where no agent scope can be read, the customer's.
     */
    private async audienceOf(claims: NodeRunClaims): Promise<NonNullable<ToolCaller["audience"]>> {
        if (claims.scope !== "public") return "internal"
        if (this.scopes === undefined) return "customer"
        const scope = await this.scopes.lensOf(claims.workspaceId, claims.agentId)
        return audienceOfModule(scope?.module ?? null)
    }

    /** Logs a refused or failed call with its cause (the typed code, the gateway code, the reason) and answers the error to throw. */
    private failed(
        tool: string,
        claims: NodeRunClaims | null,
        error: GraphNodesError,
        gatewayCode: string | null = null,
    ): GraphNodesError {
        this.logger.warn(ToolsLogEvent.NodeToolFailed, {
            workspaceId: claims?.workspaceId ?? null,
            agentId: claims?.agentId ?? null,
            runId: claims?.runId ?? null,
            tool,
            code: error.code,
            gatewayCode,
            reason: typeof error.params.reason === "string" ? error.params.reason : null,
        })
        return error
    }

    /**
     * The gateway caller of the run: its agent and conversation, its audience, the person who approved, if any, and the graph step the
     * token signs (its language, hand-off, lead and allow-list), which the NIVO effect tools need. Every call of this door is a
     * workflow step (`graphStep`): its road is `node`, and it names the step the token signs (the node, the pinned version, its
     * workflow) when the engine gave one, for the audit line.
     */
    private async callerOf(
        claims: StepClaims,
        key: string,
        approvedBy: string | undefined,
        account: NodeToolAccount | undefined,
    ): Promise<ToolCaller> {
        const run = runOfClaims(claims)
        return {
            workspaceId: claims.workspaceId,
            agentId: claims.agentId,
            conversationId: claims.conversationId,
            workItemId: null,
            opKey: key,
            turnId: claims.runId,
            audience: await this.audienceOf(claims),
            graphStep: true,
            origin: "node",
            ...(claims.step === undefined ? {} : seenAtStep("node", claims.step)),
            ...(approvedBy === undefined ? {} : { approvedBy }),
            ...(run === undefined ? {} : { run }),
            ...(account === undefined
                ? {}
                : {
                      connectionId: account.connectionId,
                      provider: account.provider,
                      attempt: account.attempt,
                      chosenBy: account.chosenBy,
                  }),
        }
    }

    /** True for a run no person stands behind, and for one an owner or manager of the workspace does; default deny otherwise. */
    private async memberMayCall(claims: NodeRunClaims): Promise<boolean> {
        if (claims.memberId === null) return true
        if (this.members === undefined) return false
        const stewards = await this.members.firstStewards(claims.workspaceId, STEWARDS_MAX)
        return stewards.some((seat) => seat.seat_id === claims.memberId)
    }
}
