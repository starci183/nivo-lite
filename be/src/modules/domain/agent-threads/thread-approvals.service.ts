import { Injectable, Optional } from "@nestjs/common"
import { DecisionLogReadService, WorkEngineService, type WorkSpec } from "@modules/domain/decisions"
import { GraphNodesError, GraphNodesErrorCode, type NodeToolApproval, type NodeTurn } from "@modules/domain/graph-nodes"
import {
    ProviderAbilitiesService,
    abilityDecisionOf,
    callWordsOf,
    type AbilityLabel,
    type CallWord,
} from "@modules/domain/mcp-gateway"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService, type WorkItem } from "@modules/domain/work-items"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { parseJsonText } from "@modules/platform/primitives"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { RunStopsService, type StopRunRef } from "./stops/run-stops.service"
import type { RunStop, StopCardContext, StopDecision, StopQuestion } from "./stops/run-stop.contracts"
import type { ThreadRunsService, ThreadWakeAdmission } from "./thread-runs.service"

/** The action of the owner's item that approves one tool call of a step: the same action as the old engine's, so the Office words it the same. */
export const TOOL_APPROVAL_ACTION = "approve_tool_call"

/** The engine an approval item of a thread run names in its fields: the performer tells a thread's item from the old engine's by it. */
export const THREAD_APPROVAL_ENGINE = "langgraph"

/** The name under which the engine raises the item in the Office, and decides it when the deadline passes. */
const ENGINE_ACTOR = "NIVO"

/** The facts of an approval stop the engine reads back: never words of the founder. */
const FACT = {
    tool: "tool",
    ability: "ability",
    account: "account",
    workItem: "workItemId",
    fingerprint: "fingerprint",
    verdict: "verdict",
} as const

/** The names an argument of the call may not take on the card: the engine's own facts. */
const RESERVED: ReadonlySet<string> = new Set(Object.values(FACT))

/** The verdict fact of a stop whose item a person refused (or whose deadline passed), before the item itself is marked. */
const REFUSED = "refused"

/** The prefix of the verdict fact of a stop whose item the owner approved: `approved:<member>`. */
const APPROVED_PREFIX = "approved:"

/** Who an approval is audited under when the decision log names nobody (an item decided before the log kept its decider). */
const APPROVER_UNKNOWN = "owner"

/** The business key of the approval items of one step of one run; each call asked for adds `:<fingerprint>`. */
export const approvalKeyOf = (runId: string, stepKey: string): string => `tool-approval:${runId}:${stepKey}`

/** The tool call a step asked a person for, as the node host's typed error carries it. */
export interface ApprovalAsk {
    /** The tool (or effect) id. */
    readonly tool: string
    /** The fingerprint of the tool and its exact arguments. */
    readonly fingerprint: string
    /** Why the right asked (`ask_mode`, `tainted_input`, ...). */
    readonly reason: string
    /** The arguments, when the error carries them; the card then lists them in plain words. */
    readonly args: unknown
}

/** The arguments an approval error carries: the door's JSON text of plain words, read back; anything else as it is. */
const argsOf = (args: unknown): unknown => {
    if (typeof args !== "string") return args ?? null
    const read = parseJsonText(args)
    return read.ok ? read.value : null
}

/** The ask a host refusal carries, or null when it is no approval to ask or names no fingerprint. */
export const approvalAskOf = (cause: unknown): ApprovalAsk | null => {
    if (!(cause instanceof GraphNodesError) || cause.code !== GraphNodesErrorCode.ToolApprovalRequired) return null
    const { tool, fingerprint, reason, args } = cause.params
    if (typeof fingerprint !== "string" || fingerprint === "") return null
    return {
        tool: typeof tool === "string" ? tool : "",
        fingerprint,
        reason: typeof reason === "string" ? reason : "",
        args: argsOf(args),
    }
}

/** The step of a thread that asked for an approval: who and where, the turn it ran in, and the card's context. */
export interface ApprovalStep {
    /** The workspace. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
    /** The step that asked. */
    readonly stepKey: string
    /** The agent of the run. */
    readonly agentId: string
    /** The workflow the run executes, or null. */
    readonly workflowId: string | null
    /** The customer of the run, or null (a bank-fed run). */
    readonly leadId: string | null
    /** The turn the node ran in: its conversation and language. */
    readonly turn: NodeTurn
    /** The context of the stop's card (workflow and step in the team's words). */
    readonly card: StopCardContext
}

/**
 * Why an ask is the step's trouble instead of a stop (the AI core reads it and may report): `refused` (a person refused this exact call,
 * or the deadline passed), `spent` (approved once and still asks: one approval reaches a run of a step), `unreadable` (no fingerprint),
 * `unavailable` (the owner's item could not be raised).
 */
export type ApprovalTroubleCode =
    "tool_approval_refused" | "tool_approval_spent" | "tool_approval_unreadable" | "tool_approval_unavailable"

/** What became of an ask: the step stops for the owner's verdict, or it is the step's trouble. */
export type ApprovalAsked =
    | {
          /** The step waits at the gate for the owner's verdict on the item. */
          readonly kind: "stopped"
          /** The question the gate hands `scope.stop`. */
          readonly question: StopQuestion
          /** The owner's item. */
          readonly workItemId: string
      }
    | {
          /** The ask is the step's trouble. */
          readonly kind: "trouble"
          /** Why. */
          readonly code: ApprovalTroubleCode
          /** The facts in a line, for the AI core. */
          readonly text: string
      }

/** A verdict on the item of an approval stop, as its performer hands it: the workspace, the run and step the item names, the item. */
export interface ApprovalVerdict {
    readonly workspaceId: string
    readonly runId: string
    readonly stepKey: string
    readonly workItemId: string
    /** `approved` runs the step again with the approval of exactly that call; `refused` runs it again with the refusal. */
    readonly verdict: "approved" | "refused"
    /** The member who decided, or null for the engine (the deadline passed). */
    readonly by: string | null
    /** The refusal in words the step's model reads (refused by a person only). */
    readonly text: string
}

/** What a verdict became: handed to the thread runs, or refused with nothing written. */
export type ApprovalDecided =
    | ThreadWakeAdmission
    | {
          /** Nothing was handed to the thread. */
          readonly kind: "refused"
          /** Why: the run no longer waits on this item, or an approval names no person. */
          readonly code: "thread_not_waiting" | "approval_stale" | "approver_unknown"
      }
    | {
          /** Nothing was handed to the thread: a person decided the item while the deadline ran, so that verdict moves it. */
          readonly kind: "refused"
          /** Why. */
          readonly code: "decided_meanwhile"
          /** What the work engine answered when the engine tried to close the item. */
          readonly cause: unknown
      }

/** The one thing of the thread runs a verdict needs: the resume that writes a wake (never the port's resume). */
export type ThreadResumer = Pick<ThreadRunsService, "resume">

/** The value of a fact of a stop, or null. */
const factOf = (stop: RunStop, name: string): string | null =>
    stop.detail.facts.find((fact) => fact.name === name)?.value ?? null

/** The text of a field of an item, or null. */
const fieldOf = (item: WorkItem, name: string): string | null => {
    const value = item.proposal.fields[name]
    return typeof value === "string" && value !== "" ? value : null
}

/** The arguments as fact lines, an argument named like an engine fact renamed so the engine never misreads it. */
const argFactsOf = (words: ReadonlyArray<CallWord>): ReadonlyArray<{ readonly name: string; readonly value: string }> =>
    words.map((word) => ({ name: RESERVED.has(word.name) ? `arg.${word.name}` : word.name, value: word.value }))

/** The account a call acts on, as the owner reads it: the provider and the account's own name, and the ability in business words. */
interface AccountWords {
    /** The provider and the account's own name. */
    readonly account: string
    /** The ability in business words. */
    readonly ability: string
    /** The connected account. */
    readonly connectionId: string
}

/** The account words read from the board (none when no provider ability asked), or why the board could not be read. */
type AccountRead =
    | { readonly kind: "read"; readonly words: AccountWords | null }
    | { readonly kind: "failed"; readonly cause: unknown }

/** The owner's item raised (or found by its key), or why the work engine refused it. */
type Raised =
    { readonly kind: "raised"; readonly item: WorkItem } | { readonly kind: "failed"; readonly cause: unknown }

/** A label in the team's language, or the key itself when the catalogue names none. */
const labelIn = (label: AbilityLabel | undefined, key: string, locale: NodeTurn["locale"]): string => {
    if (label === undefined) return key
    return locale === "en" ? label.en : label.vi
}

/** The words of a failure, for the trouble line the AI core reads. */
const causeText = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

@Injectable()
/**
 * Approvals of an `ask` ability on a THREAD run (engine `langgraph`): the stop of kind `approval`. A call the node host refused with
 * "approval required" stops its step with ONE owner item (`approve_tool_call`, once per run, step and exact call; no line of its own) and
 * the step's stop, whose card is the one permission request (tool, account, arguments in plain words). The verdict comes back through the
 * item's performer: approved, the step runs again carrying the approval of exactly that call, which then runs once under the step's own
 * call key (effect ledger, replay ports); refused, the step runs again with the refusal in words and the same call is never asked again.
 * Only the thread runs' `resume` moves the thread, never the LangGraph port. The verdict is kept on the stop before the thread is woken.
 */
export class ThreadApprovalsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly stops: RunStopsService,
        private readonly records: RunStopRecordsService,
        @Optional() private readonly engine?: WorkEngineService,
        @Optional() private readonly items?: WorkItemsService,
        @Optional() private readonly installations?: InstallationRecordsService,
        @Optional() private readonly abilities?: ProviderAbilitiesService,
        @Optional() private readonly deciders?: DecisionLogReadService,
    ) {}

    /**
     * A step's call asked for a person: raises the owner's item for exactly that call (once) and opens the step's stop of kind
     * `approval`, whose question the gate hands `scope.stop`. A call a person already refused (or let expire), a call already approved
     * that asks again, and an ask that cannot be read or raised are the step's trouble instead: the step never waits on an item nobody
     * can decide.
     */
    async asked(step: ApprovalStep, cause: unknown): Promise<ApprovalAsked> {
        const ask = approvalAskOf(cause)
        if (ask === null)
            return {
                kind: "trouble",
                code: "tool_approval_unreadable",
                text: "approval asked without a call fingerprint",
            }
        const ref = { workspaceId: step.workspaceId, runId: step.runId }
        const dedupeKey = `${approvalKeyOf(step.runId, step.stepKey)}:${ask.fingerprint}`
        const [existing, stop] = await Promise.all([
            this.items?.findByDedupe(step.workspaceId, dedupeKey) ?? null,
            this.stops.stopOf(ref, step.stepKey),
        ])
        const settled = this.settledOf(existing, stop, ask)
        if (settled !== null) return settled
        const read = await this.accountOf(step, ask.tool)
        const account = read.kind === "read" ? read.words : null
        const words = callWordsOf(ask.args)
        const summary = this.catalog.get("agentGraphs.toolApproval.title", { tool: ask.tool }, step.turn.locale)
        const raised: Raised =
            existing === null
                ? await this.raised(step, ask, dedupeKey, summary, account, words)
                : { kind: "raised", item: existing }
        if (raised.kind === "failed") {
            return {
                kind: "trouble",
                code: "tool_approval_unavailable",
                text: `approval item for ${ask.tool} could not be raised: ${causeText(raised.cause)}`,
            }
        }
        const item = raised.item
        const question = await this.stops.stopped({
            workspaceId: step.workspaceId,
            runId: step.runId,
            stepKey: step.stepKey,
            agentId: step.agentId,
            workflowId: step.workflowId,
            leadId: step.leadId,
            conversationId: step.turn.conversationId,
            kind: "approval",
            reason: summary,
            question: null,
            suggestions: [],
            facts: [
                { name: FACT.tool, value: ask.tool },
                ...(account === null
                    ? []
                    : [
                          { name: FACT.account, value: account.account },
                          { name: FACT.ability, value: account.ability },
                      ]),
                ...argFactsOf(words),
                { name: FACT.workItem, value: item.id },
                { name: FACT.fingerprint, value: ask.fingerprint },
            ],
            card: step.card,
        })
        return { kind: "stopped", question, workItemId: item.id }
    }

    /**
     * The approval a run of the step carries into the node host: the owner's verdict kept on the open approval stop (the run right
     * after the verdict), else the newest item of the step the owner approved (a later run of the same step, after another stop: the
     * approved call answers from the effect ledger instead of asking again). Null for a step that was never asked about.
     */
    async approvalOf(ref: StopRunRef, stepKey: string): Promise<NodeToolApproval | null> {
        const stop = await this.stops.stopOf(ref, stepKey)
        if (stop === null) return null
        const verdict = factOf(stop, FACT.verdict)
        const fingerprint = factOf(stop, FACT.fingerprint)
        if (stop.kind === "approval" && fingerprint !== null && verdict?.startsWith(APPROVED_PREFIX) === true)
            return { by: verdict.slice(APPROVED_PREFIX.length), fingerprint }
        const item = await this.items?.latestOfKey(
            ref.workspaceId,
            TOOL_APPROVAL_ACTION,
            approvalKeyOf(ref.runId, stepKey),
        )
        if (item?.status !== "done") return null
        const approved = fieldOf(item, FACT.fingerprint)
        if (approved === null) return null
        const by = (await this.deciders?.decidersOf([item.id]))?.get(item.id) ?? null
        return { by: by ?? APPROVER_UNKNOWN, fingerprint: approved }
    }

    /**
     * Maps the owner's verdict on the item to the thread: kept on the stop first, then handed to the thread runs' `resume` (a wake the
     * drain applies under the lease). Approved: `retry` by the owner, so the step runs again and carries the approval. Refused by a
     * person: `answer` with the refusal in words. Refused by the deadline: `timeout` (no words; the same call is refused when it asks
     * again). Refused with nothing written when the run no longer waits on this item.
     */
    async decided(verdict: ApprovalVerdict, runs: ThreadResumer): Promise<ApprovalDecided> {
        const ref = { workspaceId: verdict.workspaceId, runId: verdict.runId }
        const stop = await this.stops.stopOf(ref, verdict.stepKey)
        if (stop?.state !== "open" || stop.kind !== "approval") return { kind: "refused", code: "thread_not_waiting" }
        if (factOf(stop, FACT.workItem) !== verdict.workItemId) return { kind: "refused", code: "approval_stale" }
        if (verdict.verdict === "approved" && verdict.by === null) return { kind: "refused", code: "approver_unknown" }
        const kept = verdict.verdict === "approved" ? `${APPROVED_PREFIX}${verdict.by ?? ""}` : REFUSED
        await this.records.patch(verdict.workspaceId, stop.id, (fresh) =>
            fresh.kind !== "approval" || factOf(fresh, FACT.workItem) !== verdict.workItemId
                ? null
                : {
                      detail: {
                          ...fresh.detail,
                          facts: [
                              ...fresh.detail.facts.filter((fact) => fact.name !== FACT.verdict),
                              { name: FACT.verdict, value: kept },
                          ],
                      },
                  },
        )
        return runs.resume(ref, this.decisionOf(verdict))
    }

    /**
     * The 24 h deadline of an approval stop passed (the deadlines' job calls this): the owner's item, while it still waits, is closed as
     * refused by the engine, whose performer hands the thread a `timeout`; an item that no longer waits (failed, or decided while the
     * deadline ran) is left as it is and the thread is handed the `timeout` here, unless it already moved on. Null when the step has no
     * open approval stop.
     */
    async expired(ref: StopRunRef, stepKey: string, runs: ThreadResumer): Promise<ApprovalDecided | null> {
        const stop = await this.stops.stopOf(ref, stepKey)
        if (stop?.state !== "open" || stop.kind !== "approval") return null
        const workItemId = factOf(stop, FACT.workItem)
        if (workItemId === null) return null
        const [item] = (await this.items?.findMany([workItemId], 1)) ?? []
        if (this.engine !== undefined && item?.workspace_id === ref.workspaceId && item.status === "waiting_decision") {
            try {
                await this.engine.resumeWork(
                    { workspaceId: ref.workspaceId, actor: ENGINE_ACTOR, locale: "vi" },
                    workItemId,
                    "rejected",
                    {},
                    { name: ENGINE_ACTOR, kind: "staff" },
                    null,
                )
                return { kind: "admitted", fresh: true }
            } catch (cause) {
                // Decided by a person meanwhile: the verdict of that decision moves the thread, nothing is handed here.
                return { kind: "refused", code: "decided_meanwhile", cause }
            }
        }
        return this.decided({ ...ref, stepKey, workItemId, verdict: "refused", by: null, text: "" }, runs)
    }

    /** The decision a verdict hands the thread. */
    private decisionOf(verdict: ApprovalVerdict): StopDecision {
        const at = this.clock.now().toISOString()
        if (verdict.verdict === "approved") return { kind: "retry", by: verdict.by ?? APPROVER_UNKNOWN, at }
        return verdict.by === null
            ? { kind: "timeout", at }
            : { kind: "answer", text: verdict.text, by: verdict.by, at }
    }

    /**
     * The trouble of an ask that must not wait on a person again: the call was refused (its item closed refused or failed, or the stop
     * keeps the refusal while the item is still being closed), or it was approved already and still asks. Null when the step may wait.
     */
    private settledOf(existing: WorkItem | null, stop: RunStop | null, ask: ApprovalAsk): ApprovalAsked | null {
        const kept =
            existing !== null &&
            stop !== null &&
            stop.kind === "approval" &&
            factOf(stop, FACT.workItem) === existing.id
                ? factOf(stop, FACT.verdict)
                : null
        if (kept === REFUSED || existing?.status === "rejected" || existing?.status === "failed")
            return {
                kind: "trouble",
                code: "tool_approval_refused",
                text: `the owner did not approve ${ask.tool} with these arguments`,
            }
        if (existing?.status === "done" || kept?.startsWith(APPROVED_PREFIX) === true)
            return {
                kind: "trouble",
                code: "tool_approval_spent",
                text: `${ask.tool} was approved once already and asked again`,
            }
        return null
    }

    /** Raises the owner's item for the call, once per run, step and call: the stop's card is its one message. Null when it cannot be raised. */
    private async raised(
        step: ApprovalStep,
        ask: ApprovalAsk,
        dedupeKey: string,
        summary: string,
        account: AccountWords | null,
        words: ReadonlyArray<CallWord>,
    ): Promise<Raised> {
        try {
            const installation = await this.installations?.ofAgent(step.workspaceId, step.agentId)
            const spec: WorkSpec = {
                action: TOOL_APPROVAL_ACTION,
                ...(installation === null || installation === undefined ? {} : { department: installation.moduleKey }),
                subject_type: step.leadId === null ? "conversation" : "lead",
                subject_id: step.leadId ?? step.turn.conversationId,
                lead_id: step.leadId,
                dedupeKey,
                seed: {
                    summary,
                    fields: {
                        engine: THREAD_APPROVAL_ENGINE,
                        runId: step.runId,
                        stepKey: step.stepKey,
                        tool: ask.tool,
                        fingerprint: ask.fingerprint,
                        reason: ask.reason,
                        conversation_id: step.turn.conversationId,
                        account: account?.account ?? null,
                        ability: account?.ability ?? null,
                        connectionId: account?.connectionId ?? null,
                        args: words.map((word) => `${word.name}: ${word.value}`).join("\n"),
                    },
                },
                preset: true,
                noChain: true,
                forceAsk: "branch_ask",
                // The stop's card is the one permission request in the team chat: the engine says no line of its own.
                ownCard: true,
            }
            if (this.engine === undefined) return { kind: "failed", cause: "no work engine in this app" }
            const item = await this.engine.runWork(
                { workspaceId: step.workspaceId, actor: ENGINE_ACTOR, locale: step.turn.locale === "en" ? "en" : "vi" },
                spec,
            )
            return { kind: "raised", item }
        } catch (cause) {
            return { kind: "failed", cause }
        }
    }

    /**
     * The connected account the call asks on and the ability, in the owner's words: the agent's attachment whose `ask` tick made the
     * right ask (the strictest tick wins), read from the board. Null for a call no provider ability asked about (a tool grant in ask
     * mode, a tainted input) or when the board cannot be read: the card then names the tool alone.
     */
    private async accountOf(step: ApprovalStep, tool: string): Promise<AccountRead> {
        if (this.abilities === undefined) return { kind: "read", words: null }
        try {
            const verdict = await this.abilities.judge(step.workspaceId, step.agentId, tool, false)
            if (abilityDecisionOf(verdict) !== "ask" || verdict?.kind !== "approval")
                return { kind: "read", words: null }
            const board = await this.abilities.board(step.workspaceId)
            const provider = board.providers.find((one) => one.provider === verdict.provider)
            const account = provider?.accounts.find((one) => one.connectionId === verdict.connectionId)
            const ability = provider?.abilities.find((one) => one.id === verdict.ability)
            const providerName = labelIn(provider?.label, verdict.provider, step.turn.locale)
            return {
                kind: "read",
                words: {
                    account: account === undefined ? providerName : `${providerName} · ${account.label}`,
                    ability: labelIn(ability?.label, verdict.ability, step.turn.locale),
                    connectionId: verdict.connectionId,
                },
            }
        } catch (cause) {
            // A board that cannot be read never keeps the owner from being asked: the card names the tool alone.
            return { kind: "failed", cause }
        }
    }
}
