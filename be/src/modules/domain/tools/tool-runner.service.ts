import { isRefused, type SubjectRef } from "@nivo-lite/agent-sdk/node"
import {
    EffectOutcomeUnknownError,
    GraphNodesError,
    GraphNodesErrorCode,
    OUTCOME_UNKNOWN_KIND,
    isOutcomeUnknownCode,
    runLeadOf,
    toolFingerprintOf,
    type GraphNodeEffectsService,
    type GraphNodeRegistryService,
    type NodeEffectRun,
    type NodeStepRef,
    type NodeToolAccount,
    type NodeToolAnswer,
    type NodeToolDoor,
    type NodeToolRun,
    type NodeToolVia,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import type { CallLogLine } from "@modules/domain/tool-call-log"
import type { ToolJson } from "@modules/domain/tool-receipts"
import { proofOf } from "@modules/domain/provider-registry"
import { repeatableBySpec, takesOneAccountBySpec, toolSpecOf } from "@modules/domain/tool-specs"
import type { Clock } from "@modules/platform/clock"
import { isDomainError } from "@modules/platform/errors"
import type { Logger } from "@modules/platform/logging"
import { pinRefusalOf } from "./adapters/effect-pin.policy"
import { answerOf, effectAddressOf, jsonOf, refusalOf } from "./adapters/effect-tools.policy"
import { argsHashOf, masked, summaryOf } from "./audit-mask.policy"
import type { ConversationLeadsGate, NativeCaller } from "./tools.contracts"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import { ToolsLogEvent } from "./tools.log-events"
import { RECEIPT_REPLAY } from "./tool-registry.service"
import { isProviderBound, mutatesOf } from "./provider-abilities.policy"
import type { AgentAccountsService, BoundAccount } from "./agent-accounts.service"
import { seenAtStep } from "./node-rule.policy"
import { receiptAt } from "./step-receipts.policy"

/**
 * The person who approved exactly this effect call on this account (the approval's fingerprint is the call's own), or null: what the
 * audit line names and the executor's turn carries (`NodeTurn.approvedBy`).
 */
const approverOf = (call: NodeEffectRun, account: NodeToolAccount | undefined): string | null =>
    call.approval !== null && call.approval.fingerprint === toolFingerprintOf(call.effect, call.payload, account?.connectionId)
        ? call.approval.by
        : null

/** The connector an effect's audit line names when its id has no domain. */
const EFFECTS_CONNECTOR = "effects"

/** Where an audit line of the runner says the call came from: a workflow step. */
const NODE_ORIGIN = "node"

/** The most attempts whose call positions the runner keeps at once (the oldest is forgotten first). */
const POSITIONS_KEPT = 2000

/** What the runner is made of: the door's own checks and call, the effect ledger and executors, the bound accounts, and the audit. */
export interface ToolRunnerParts {
    /** The door whose right the effect road asks (`effectRight`) and whose `call` the tool road makes. */
    readonly door: Omit<NodeToolDoor, "run">
    /** The executors of the installed effects. */
    readonly registry: Pick<GraphNodeRegistryService, "executorOf">
    /**
     * The once-per-key ledger of effects, and the records of a run step (`recordsOf`: the step's receipts, read when a write of a step
     * that runs again would act; absent, only the same key replays).
     */
    readonly ledger: Pick<GraphNodeEffectsService, "once"> & Partial<Pick<GraphNodeEffectsService, "recordsOf">>
    /**
     * The accounts a call may act on, in order, whether its step's node lists a provider serving it (`listsProviders`: absent, every
     * call that takes an account needs one), and the choice the owner still has to make when the agent holds several accounts of a
     * listed provider and nothing picks one (`pickNeeded`: absent, a call that binds none is the never-sent refusal as before); absent
     * where no provider rights are bound (no call is then handed an account).
     */
    readonly accounts?:
        | (Pick<AgentAccountsService, "boundAccountsOf"> & Partial<Pick<AgentAccountsService, "listsProviders" | "pickNeeded">>)
        | undefined
    /** Which lead a conversation belongs to, for the run's pin; null when nothing can say. */
    readonly leads: ConversationLeadsGate | null
    /** The audit (`mcp_call_log`); absent in an app that keeps none. */
    readonly audit?: { append(line: CallLogLine): Promise<void> } | undefined
    /** The clock. */
    readonly clock: Clock
    /** The logger. */
    readonly logger: Logger
}

/** How one effect call ended, as its audit line says it. */
interface EffectEnd {
    readonly outcome: "ok" | "refused" | "error" | "approval"
    readonly code: string | null
    readonly summary: string
}

/** A record as the audit carries it. */
const auditJsonOf = (value: Readonly<Record<string, unknown>>): ToolJson =>
    Object.fromEntries(
        Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([member, entry]) => [member, jsonOf(entry)]),
    )

/**
 * The run an effect call is pinned to, read from the turn the run token was minted from: its conversation, and for a run that serves
 * none the customer it is about (the token's own `leadId`).
 */
const pinCallerOf = (turn: NodeTurn): NativeCaller => {
    const leadId = turn.conversationId === null ? runLeadOf(turn) : null
    return {
        agentId: turn.agentId,
        conversationId: turn.conversationId,
        ...(leadId === null
            ? {}
            : {
                  run: {
                      turnId: turn.turnId,
                      locale: turn.locale,
                      origin: turn.origin ?? "system",
                      memberId: turn.memberId ?? null,
                      handedOffBy: turn.handedOffBy ?? null,
                      leadId,
                      stepTools: [],
                  },
              }),
    }
}

/** The id a call names: the effect or the tool. */
const idOf = (call: NodeToolRun): string => (call.road === "effect" ? call.effect : call.tool)

/**
 * True when a call may be handed ONE account by the runner (nivo-frame `templates`: the NODE lists its providers in order and the runner
 * binds each to the agent's attached account of it). A core tool: by its spec, the registry's data (`any`: the node's list; `default`:
 * the workspace's default account of the kind), never for a read whose adapter merges every account and never where the call's data
 * names its owner (a customer send goes on the conversation's own connection, which its executor reads). A tool of no core spec (a
 * plugin's own tool or effect, an operation of a pinned document): unless the call itself places its provider (`isProviderBound`), it
 * takes the accounts its node lists, if any (none listed: none bound, and it runs with none).
 */
export const takesOneAccount = (id: string): boolean => {
    const held = toolSpecOf(id)
    return held === null ? !isProviderBound(id) : takesOneAccountBySpec(held)
}

/** The failure codes a door gives for a call that never reached the provider's account: it was not connected, or it was refused there. */
const NEVER_SENT: ReadonlySet<string> = new Set([
    GraphNodesErrorCode.ToolNotConnected,
    GraphNodesErrorCode.ToolConnectionRefused,
])

/** What a failure proves, from the typed facts the adapter or the door attached where it failed: never from a message. */
const failureProofOf = (cause: unknown): "not_sent" | "unknown" | null => {
    const typed = proofOf(cause)
    if (typed !== null) return typed
    if (!(cause instanceof GraphNodesError)) return null
    if (NEVER_SENT.has(cause.code)) return "not_sent"
    const { proof } = cause.params
    return proof === "not_sent" || proof === "unknown" ? proof : null
}

/** True for an ask for a person's approval or a rights refusal: an answer about the call, never a failure to go around. */
const isDecision = (cause: unknown): boolean =>
    cause instanceof GraphNodesError &&
    (cause.code === GraphNodesErrorCode.ToolApprovalRequired || cause.code === GraphNodesErrorCode.ToolNotGranted)

/**
 * Whether a failed call may go on to the next bound account, by a generic transport fact (nivo-frame `rights`): a read on any failure; a
 * write only on a failure proved `not_sent` (an `unknown` outcome stops and is reported). An ask or a rights refusal is never gone around.
 * No business class decides it.
 */
const movesOn = (mutates: boolean, cause: unknown): boolean => {
    if (isDecision(cause)) return false
    if (!mutates) return true
    return failureProofOf(cause) === "not_sent"
}

/** The reason of a refusal of the right the door threw (`GRAPH_NODES_TOOL_NOT_GRANTED` with a text reason), else null. */
const rightRefusalOf = (cause: unknown): string | null => {
    if (!(cause instanceof GraphNodesError) || cause.code !== GraphNodesErrorCode.ToolNotGranted) return null
    const { reason } = cause.params
    return typeof reason === "string" && reason !== "" ? reason : null
}

/**
 * The ONE runner of a node's calls (C4): `context.effect` and `context.tools.call` both reach it through the host, under the same
 * call key for the same id and arguments (`<run>:<step>:<digest>`).
 *
 * Accounts: a call that acts on one connected account is handed the node's bound accounts in order (the node's rows, by position;
 * else the agent's attachments), the first first; it is judged on that account alone, its approval covers that account alone, and on
 * a failure it goes on to the next by whether the failure proves nothing was sent (`movesOn`). A customer send stays on the account its data's owner (the
 * conversation) names; a read covers every bound account at once.
 *
 * The effect road: the right of the run's agent on the account (the door's `effectRight`: the node's mode, an ask BEFORE anything
 * runs), the run's pin (a call stays in its run's conversation or lead), the step's receipts (a step that runs again answers its
 * earlier write at the same position from its receipt), then the once-per-key ledger (a write that happened is answered again, never
 * a refusal), inside which the executor runs, then one audit line. The tool road: the door's `call` (the engine tools registry with its grants,
 * receipts, breaker and audit line). The answer names the account the call ran on (`via`).
 */
/** The run and the step of a call's attempt (`<run id>:<step key>`), or null when the attempt names no step. */
const attemptPlaceOf = (call: NodeEffectRun): { readonly runId: string; readonly stepKey: string } | null => {
    const split = call.attempt.step.indexOf(":")
    return split <= 0 ? null : { runId: call.attempt.step.slice(0, split), stepKey: call.attempt.step.slice(split + 1) }
}

/** The place the ledger keeps a call under: the attempt's run and step, when it names them. */
const placeRecordOf = (call: NodeEffectRun): { readonly place?: { readonly runId: string; readonly stepKey: string } } => {
    const place = attemptPlaceOf(call)
    return place === null ? {} : { place }
}

export class ToolRunnerService {
    constructor(private readonly parts: ToolRunnerParts) {}

    /** Runs one call of a node and answers what it came to. */
    async run(call: NodeToolRun): Promise<NodeToolAnswer> {
        const accounts = await this.accountsOf(call)
        if (accounts.length === 0 && (await this.bindsAccount(call))) {
            // Several accounts of a listed provider and no rule of the order picks one (the run's trigger, its earlier calls, the agent's
            // default account): the typed refusal that names the choice to make, never a guess (readiness shows it as `needs_pick`).
            const needed = await this.pickNeeded(call)
            if (needed !== null) {
                throw new ToolsError({
                    code: ToolsErrorCode.AccountNeedsPick,
                    params: { tool: idOf(call), provider: needed.provider, connectionIds: needed.connectionIds.join(",") },
                })
            }
            // A step whose node binds no account serving the tool (no provider of it attached): the typed never-sent refusal, which
            // freezes the step and is reported (readiness hides such a graph beforehand).
            throw new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool: idOf(call) } })
        }
        const mutates = call.road === "effect" || mutatesOf(idOf(call))
        const tried = async (index: number): Promise<NodeToolAnswer> => {
            const bound = accounts[index]
            if (bound === undefined) return this.once(call, undefined)
            const account: NodeToolAccount = { ...bound, attempt: index + 1, chosenBy: index === 0 ? "order" : "fallback" }
            try {
                return await this.once(call, account)
            } catch (cause) {
                if (index + 1 >= accounts.length || !movesOn(mutates, cause)) throw cause
                this.parts.logger.warn(ToolsLogEvent.NodeToolFailed, {
                    workspaceId: call.turn.workspaceId,
                    agentId: call.turn.agentId,
                    tool: idOf(call),
                    connectionId: bound.connectionId,
                    attempt: index + 1,
                    fallback: true,
                })
                return tried(index + 1)
            }
        }
        return tried(0)
    }

    /**
     * True for a call of a workflow step that must be handed ONE account by the runner (none bound is then the typed never-sent refusal:
     * the kill switch): a call that takes one (`takesOneAccount`) and whose NODE lists a provider serving
     * it (`listsProviders`). A node that lists none of them runs the call with none (its adapter's own pick, or NIVO's own).
     */
    private bindsAccount(call: NodeToolRun): Promise<boolean> {
        const id = idOf(call)
        const { accounts } = this.parts
        const step = call.workflowStep
        if (accounts === undefined || step === undefined || !takesOneAccount(id)) return Promise.resolve(false)
        // Without the reader of the node's list (a narrow runner), every such tool needs one, as before the node listed its providers.
        if (accounts.listsProviders === undefined) return Promise.resolve(true)
        return Promise.resolve(accounts.listsProviders(call.turn.workspaceId, call.turn.agentId, id, seenAtStep("node", step)))
    }

    /** The choice still to make for a call of a workflow step (several accounts of a listed provider, none picked), or null. */
    private async pickNeeded(call: NodeToolRun): Promise<{ readonly provider: string; readonly connectionIds: ReadonlyArray<string> } | null> {
        const { accounts } = this.parts
        const step = call.workflowStep
        if (accounts?.pickNeeded === undefined || step === undefined) return null
        const { workspaceId, agentId, turnId } = call.turn
        return accounts.pickNeeded(workspaceId, agentId, idOf(call), seenAtStep("node", step), { runId: turnId })
    }

    /** The accounts a call may act on, in order; none for a call that is handed no account. */
    private accountsOf(call: NodeToolRun): Promise<ReadonlyArray<BoundAccount>> {
        const { accounts } = this.parts
        const id = idOf(call)
        if (accounts === undefined || !takesOneAccount(id)) return Promise.resolve([])
        const step: NodeStepRef | undefined = call.workflowStep
        const { workspaceId, agentId } = call.turn
        return Promise.resolve(step === undefined
            ? accounts.boundAccountsOf(workspaceId, agentId, id)
            : accounts.boundAccountsOf(workspaceId, agentId, id, seenAtStep("node", step), { runId: call.turn.turnId }))
    }

    /** One try of the call, on the account handed, or on the adapter's own pick when none is. */
    private async once(call: NodeToolRun, account: NodeToolAccount | undefined): Promise<NodeToolAnswer> {
        const via: NodeToolVia | undefined =
            account === undefined ? undefined : { provider: account.provider, connectionId: account.connectionId }
        if (call.road === "tool") {
            const value = await this.parts.door.call(account === undefined ? call : { ...call, account })
            return { road: "tool", value, ...(via === undefined ? {} : { via }) }
        }
        const subject = await this.effect(call, account)
        return { road: "effect", subject, ...(via === undefined ? {} : { via }) }
    }

    private async effect(call: NodeEffectRun, account: NodeToolAccount | undefined): Promise<SubjectRef> {
        const started = this.parts.clock.now().getTime()
        const refused = await this.judged(call, account, started)
        if (refused !== null) return refused
        const pinned = await pinRefusalOf(this.parts.leads, call.turn.workspaceId, pinCallerOf(call.turn), call.payload)
        if (pinned !== null) {
            await this.audited(call, account, started, { outcome: "refused", code: pinned, summary: "" })
            return refusalOf(pinned)
        }
        // A step that runs again (a retry, a re-drive, a resume after an approval) answers its earlier write at the same position
        // from that write's receipt, whatever its words now: the call is not made again (nivo-frame `rights` 11d).
        const receipt = await this.receiptOf(call)
        if (receipt !== null) {
            await this.audited(call, account, started, { outcome: "ok", code: RECEIPT_REPLAY, summary: summaryOf(answerOf(receipt)) })
            return receipt
        }
        const executor = this.parts.registry.executorOf(call.effect)
        const acting = this.actingTurn(call, account)
        let executed = false
        try {
            const subject = await this.parts.ledger.once(
                call.turn.workspaceId,
                call.effect,
                call.call,
                () => {
                    // Inside the ledger's act: a call the step already made under this key is replayed as it was.
                    executed = true
                    return executor.execute(acting, call.payload, call.call)
                },
                // The ledger keeps what the effect was asked, and the step it was asked for (the same place `receiptOf` reads), so a
                // step that runs again reads what it already did (its receipts), whatever shape the run's id has.
                { args: call.payload, ...placeRecordOf(call) },
            )
            await this.audited(call, account, started, {
                outcome: isRefused(subject) ? "refused" : "ok",
                code: isRefused(subject) ? subject.id : executed ? null : RECEIPT_REPLAY,
                summary: summaryOf(answerOf(subject)),
            })
            return subject
        } catch (cause) {
            await this.audited(call, account, started, {
                outcome: "error",
                code: isDomainError(cause) ? cause.code : "effect_failed",
                summary: "",
            })
            throw cause
        }
    }

    /** The turn an effect's executor is handed: the run's turn with the workflow step, the account and the approver of this call. */
    private actingTurn(call: NodeEffectRun, account: NodeToolAccount | undefined): NodeTurn {
        const approvedBy = approverOf(call, account)
        return {
            ...call.turn,
            ...(call.workflowStep === undefined ? {} : { step: call.workflowStep }),
            ...(account === undefined ? {} : { account: { provider: account.provider, connectionId: account.connectionId } }),
            ...(approvedBy === null ? {} : { approvedBy }),
        }
    }

    /**
     * The refusal the effect's executor says it would answer for this call (an executor that implements `refusalFor`: a side-effect-free
     * check of its own rules), or null. Asked only when the right is about to ask a person: nobody is asked to approve a call that cannot
     * go. The executor judges again when the approved call runs, because state can change between asking and approving.
     */
    private async refusalBeforeAsk(call: NodeEffectRun, account: NodeToolAccount | undefined): Promise<SubjectRef | null> {
        const executor = this.parts.registry.executorOf(call.effect)
        if (executor.refusalFor === undefined) return null
        return (await executor.refusalFor(this.actingTurn(call, account), call.payload, call.call)) ?? null
    }

    /** The refusal the right of the run's agent answers instead of running, or null; an ask is audited and thrown as it was. */
    private async judged(
        call: NodeEffectRun,
        account: NodeToolAccount | undefined,
        started: number,
    ): Promise<SubjectRef | null> {
        const { effectRight } = this.parts.door
        if (effectRight === undefined) return null
        const asked = {
            token: call.token,
            effect: call.effect,
            payload: call.payload,
            approval: call.approval,
            ...(call.refusals === undefined ? {} : { refusals: call.refusals }),
        }
        try {
            const refused = (await effectRight(account === undefined ? asked : { ...asked, account })) ?? null
            if (refused !== null) await this.audited(call, account, started, { outcome: "refused", code: refused.id, summary: "" })
            return refused
        } catch (cause) {
            const asks = cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired
            if (asks) {
                // A call its executor would refuse is answered as that refusal and raises no approval.
                const refusal = await this.refusalBeforeAsk(call, account)
                if (refusal !== null) {
                    await this.audited(call, account, started, { outcome: "refused", code: refusal.id, summary: "" })
                    return refusal
                }
            }
            // A refusal of the right the template road freezes on is audited as the refusal it is (its reason), as when it is answered.
            const refusedRight = rightRefusalOf(cause)
            await this.audited(call, account, started, {
                outcome: asks ? "approval" : refusedRight === null ? "error" : "refused",
                code: refusedRight ?? (isDomainError(cause) ? cause.code : "effect_failed"),
                summary: "",
            })
            throw cause
        }
    }

    /** The positions of the calls of each effect in each attempt of a step, counted as the calls come (one call per model turn). */
    private readonly positions = new Map<string, number>()

    /** The position of this call among its attempt's calls of the same effect, from 1. */
    private positionOf(call: NodeEffectRun): number {
        const key = `${call.turn.workspaceId}|${call.attempt.step}|${call.attempt.startedAt}|${call.effect}`
        const position = (this.positions.get(key) ?? 0) + 1
        this.positions.delete(key)
        this.positions.set(key, position)
        if (this.positions.size > POSITIONS_KEPT) {
            const [oldest] = this.positions.keys()
            if (oldest !== undefined) this.positions.delete(oldest)
        }
        return position
    }

    /**
     * The receipt of the step's earlier write at this call's position (`receiptAt`), or null when the call acts (or the ledger answers
     * it under its own key). A receipt whose outcome nobody knows answers that, as the ledger does: no machine makes the call again.
     */
    private async receiptOf(call: NodeEffectRun): Promise<SubjectRef | null> {
        const position = this.positionOf(call)
        const { ledger } = this.parts
        const place = attemptPlaceOf(call)
        if (ledger.recordsOf === undefined || place === null) return null
        // Called on the ledger itself: the service's method reads its own store through `this`.
        const records = await ledger.recordsOf(call.turn.workspaceId, place, [call.effect])
        const kept = receiptAt(records, {
            effect: call.effect,
            args: call.payload,
            position,
            startedAt: call.attempt.startedAt,
            answers: call.turn.founderAnswers,
        })
        if (kept === null) return null
        this.parts.logger.info(ToolsLogEvent.ReceiptAnswered, {
            workspaceId: call.turn.workspaceId,
            agentId: call.turn.agentId,
            step: call.attempt.step,
            effect: call.effect,
            position,
        })
        if (kept.subject.kind === OUTCOME_UNKNOWN_KIND && isOutcomeUnknownCode(kept.subject.id)) {
            // Rule Q-3: a tool that declares itself `repeatable` makes the call again (the ledger then answers it under its key).
            if (repeatableBySpec(call.effect) === true) return null
            throw new EffectOutcomeUnknownError({ code: kept.subject.id, params: { effect: call.effect } })
        }
        return kept.subject
    }

    /** Files one audit line of an effect call; a line that cannot be written is logged and never undoes what the call did. */
    private async audited(
        call: NodeEffectRun,
        account: NodeToolAccount | undefined,
        started: number,
        end: EffectEnd,
    ): Promise<void> {
        const { audit } = this.parts
        if (audit === undefined) return
        const args = auditJsonOf(call.payload)
        const step = call.workflowStep
        const approvedBy = approverOf(call, account)
        try {
            await audit.append({
                workspaceId: call.turn.workspaceId,
                connector: effectAddressOf(call.effect)?.connector ?? EFFECTS_CONNECTOR,
                tool: call.effect,
                agentId: call.turn.agentId,
                conversationId: call.turn.conversationId,
                workItemId: null,
                argsMaskedJson: JSON.stringify(masked(args)),
                argsHash: argsHashOf(args),
                outcome: end.outcome,
                errorCode: end.code,
                resultSummary: end.summary,
                durationMs: Math.max(0, this.parts.clock.now().getTime() - started),
                approvedBy,
                runId: call.turn.turnId,
                originKind: NODE_ORIGIN,
                nodeKey: step?.nodeKey ?? null,
                workflowId: step?.workflowId ?? null,
                workflowVersionId: step?.versionId ?? null,
                connectionId: account?.connectionId ?? null,
                provider: account?.provider ?? null,
                attempt: account?.attempt ?? null,
                chosenBy: account?.chosenBy ?? null,
            })
        } catch (cause) {
            this.parts.logger.error(ToolsLogEvent.CallFailed, cause, {
                workspaceId: call.turn.workspaceId,
                connector: EFFECTS_CONNECTOR,
                tool: call.effect,
            })
        }
    }
}
