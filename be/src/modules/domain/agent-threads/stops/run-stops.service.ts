import { Injectable, Optional } from "@nestjs/common"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import type { RunStopCustomerLine } from "@nivo-lite/blocks-core/entities"
import { WorkEngineService } from "@modules/domain/decisions"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { RunStopsError, RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import type {
    OptionalRunStop,
    RunStop,
    StopCardContext,
    StopDecision,
    StopOpen,
    StopQuestion,
    StopRoute,
    StopSendRefusal,
} from "./run-stop.contracts"
import { approvalItemWaitingOf, withdrawnFactsOf } from "./stop-approval.policy"
import { StopCardsService } from "./stop-cards.service"
import {
    answerIndexOf,
    stopAnswerOf,
    stopDecisionOf,
    stopQuestionOf,
    stopRouteOf,
    stopSendRefusalOf,
    stopToldOf,
} from "./stop-gate.policy"

/** The run a stop belongs to. */
export interface StopRunRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
}

/** A stop just opened: the question the gate hands `scope.stop`, and the line the customer was already told for it (or null). */
export interface StopOpened {
    /** The question of the stop. */
    readonly question: StopQuestion
    /** The newest line the customer was told for this stop with no founder's words after it, or null. */
    readonly told: RunStopCustomerLine | null
}

/** The most customer lines a stop holds (`agent.run-stop.customerLines`). */
const STOP_LINES_MAX = 50

/** A customer send as the effect ledger kept it: its arguments, the subject with the facts it answered, and when it was kept. */
export interface KeptSend {
    /** The arguments the send ran with; null when the ledger did not keep them. */
    readonly args: Readonly<Record<string, unknown>> | null
    /** The message it made, with the facts the send answered (the conversation it went to). */
    readonly subject: SubjectRef
    /** When it was kept (ISO text). */
    readonly at: string
}

/** A text member of a record, or null. */
const textOf = (record: Readonly<Record<string, unknown>> | null | undefined, name: string): string | null => {
    const value = record?.[name]
    return typeof value === "string" && value !== "" ? value : null
}

/**
 * The stop's customer lines with the sends its step made that the ledger kept (D.1): each send once (by conversation and words), the
 * conversation it went to read from the send's facts, else from its arguments; a send that names neither, or kept no words, is left
 * out. The newest `STOP_LINES_MAX` lines are kept. Null when the ledger adds nothing.
 */
export const linesWithSendsOf = (
    lines: ReadonlyArray<RunStopCustomerLine>,
    sends: ReadonlyArray<KeptSend>,
): ReadonlyArray<RunStopCustomerLine> | null => {
    const held = new Set(lines.map((line) => `${line.conversationId}
${line.text}`))
    const added = sends.flatMap((send): Array<RunStopCustomerLine> => {
        const conversationId = textOf(send.subject.facts, "conversationId") ?? textOf(send.args, "conversationId")
        const text = textOf(send.args, "text")
        if (conversationId === null || text === null || held.has(`${conversationId}
${text}`)) return []
        held.add(`${conversationId}
${text}`)
        return [{ conversationId, text, at: send.at }]
    })
    if (added.length === 0) return null
    return [...lines, ...added].toSorted((left, right) => left.at.localeCompare(right.at)).slice(-STOP_LINES_MAX)
}

/** The name under which the engine closes the owner's item of an approval stop that closed another way. */
const ENGINE_ACTOR = "NIVO"

/** Why an approval stop's item was withdrawn, as the item's decision note keeps it (a code, never prose). */
type WithdrawnBy = `stop_${StopDecision["kind"]}` | "step_completed" | "run_closed" | "stop_closed_earlier"

/** The customer a stop is about, as its record names them. */
export interface StopCustomerRef {
    /** The lead, when known. */
    readonly leadId: string | null
    /** The conversation, when known. */
    readonly conversationId: string | null
}

/**
 * The customer a stop of a run about NO customer (a bank-fed reconcile: no lead, no conversation) is about once its step told one a
 * line: the conversation of the oldest line told, and the lead a send to that conversation named (a send addressed by `leadId`). Null
 * when the stop already names a customer (its run's own: never replaced) or nothing was told. Written on the stop record, so the reads
 * that find the open stops of a customer (by lead, by conversation) find this one too and hold that customer's next wakes.
 */
export const toldCustomerOf = (
    stop: StopCustomerRef,
    lines: ReadonlyArray<RunStopCustomerLine>,
    sends: ReadonlyArray<KeptSend> = [],
): StopCustomerRef | null => {
    if (stop.leadId !== null || stop.conversationId !== null) return null
    const first = lines.toSorted((left, right) => left.at.localeCompare(right.at))[0]
    if (first === undefined) return null
    const leadId =
        sends
            .filter(
                (send) =>
                    (textOf(send.subject.facts, "conversationId") ?? textOf(send.args, "conversationId")) ===
                    first.conversationId,
            )
            .map((send) => textOf(send.args, "leadId") ?? textOf(send.subject.facts, "leadId"))
            .find((id): id is string => id !== null) ?? null
    return { leadId, conversationId: first.conversationId }
}

@Injectable()
/**
 * The stops of thread runs: the one mechanism for every run that cannot go on by itself, with a customer or without. A step that cannot
 * complete opens the stop of its run and step (`stopped`): one record, one card in the team chat (the same message for every stop of
 * that step, rewritten in place), and the question the gate node hands `scope.stop`. A decision (`decide`: the founder's words, a button
 * or a deadline) is kept on the stop and routed by the gate: back to the step with every word given, back to the gate, or to the end.
 * The stop resolves when the step then completes (`completed`), or at once on `skip`, and its card says so. While it is open, a customer
 * the stopped step already told is not told again until the founder answers in words (`sendRefusal`, read by the send door). What the
 * customer was told is kept on the stop (`customerLines`): the engine's own line (`lineSent`) and, each time the stop opens, the
 * customer sends of its step that the effect ledger kept (D.1), whatever conversation they went to. A stop of a run about no customer
 * (bank-fed) takes the customer its step told as its own (`toldCustomerOf`), so the hold of that customer finds it. A stop of kind
 * `approval` that closes by anything but its own item's verdict (a skip, the founder's words, a retry, a take-over, the step completing,
 * the run closing) withdraws that item: it is closed rejected by the engine with the reason as its note, so no approval is left open in
 * the owner's inbox for a run that no longer waits on it.
 */
export class RunStopsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly records: RunStopRecordsService,
        private readonly cards: StopCardsService,
        @Optional() private readonly ledger?: GraphNodeEffectsService,
        @Optional() private readonly work?: WorkEngineService,
    ) {}

    /** Opens the stop of a step (or opens it again), posts or folds its card, and answers the question the gate hands `scope.stop`. */
    async stopped(input: StopOpen): Promise<StopQuestion> {
        return (await this.opened(input)).question
    }

    /**
     * `stopped`, and the line the customer was already told for this stop (`stopToldOf`: the step's own sends the ledger kept, read while
     * the stop opens, or an earlier holding line; none after the founder's newest words), or null. The engine reads it before it sends a
     * holding line of its own, so a stop tells the customer one line, ever. No read beyond the one `stopped` makes.
     */
    async opened(input: StopOpen): Promise<StopOpened> {
        const now = this.clock.now().toISOString()
        const stop = await this.withSends(input.workspaceId, await this.records.open(input, now))
        const told = stopToldOf(stop)
        const messageId = await this.cards.posted(input.workspaceId, stop, input.card, now)
        if (messageId === null || messageId === stop.cardMessageId) return { question: stopQuestionOf(stop), told }
        const carded = await this.records.patch(input.workspaceId, stop.id, (fresh) =>
            fresh.cardMessageId === messageId ? null : { cardMessageId: messageId },
        )
        return { question: stopQuestionOf(carded ?? stop), told }
    }

    /**
     * Keeps a decision on the stop of the step and answers where the gate sends the thread. A value that is no decision is refused (the
     * thread stays stopped); a stop already resolved refuses a late decision. `skip` resolves the stop and its card at once. Applying a
     * decision is idempotent: a gate run again with the decision the stop already keeps (a crash between `decide` and the gate's checkpoint)
     * answers the same route and writes nothing.
     */
    async decide(
        ref: StopRunRef,
        stepKey: string,
        value: unknown,
        gate: string,
        context: Pick<StopCardContext, "locale">,
    ): Promise<StopRoute> {
        const decision = stopDecisionOf(value)
        if (decision === null) throw new RunStopsError({ code: RunStopsErrorCode.DecisionInvalid })
        const stop = await this.required(ref, stepKey)
        const answer = stopAnswerOf(decision)
        const kept = answerIndexOf(stop.answers, answer)
        if (kept >= 0) return stopRouteOf({ stepKey: stop.stepKey, answers: stop.answers.slice(0, kept) }, decision, gate)
        if (stop.state === "resolved") throw new RunStopsError({ code: RunStopsErrorCode.AlreadyResolved })
        const route = stopRouteOf(stop, decision, gate)
        const now = this.clock.now().toISOString()
        const answered = await this.records.patch(ref.workspaceId, stop.id, (fresh) =>
            answerIndexOf(fresh.answers, answer) >= 0
                ? null
                : {
                      answers: [...fresh.answers, answer],
                      decision: answer,
                      ...(route.resolves ? { state: "resolved", resolvedAt: now } : {}),
                  },
        )
        if (route.resolves && answered !== null) await this.cards.resolved(ref.workspaceId, answered, context.locale, now)
        // An answer, a retry, a take-over or a deadline keeps the stop open: its one card is rewritten in place with the trace so far.
        if (!route.resolves && answered !== null) await this.cards.rewritten(ref.workspaceId, answered, context.locale)
        // A decision that is not the verdict of the approval item (the item's own verdict is kept on the stop before it resumes the
        // thread) supersedes that item: it is withdrawn, never left open in the owner's inbox.
        if (answered !== null) await this.withdraw(ref.workspaceId, answered, `stop_${decision.kind}`, context.locale)
        return route
    }

    /**
     * The approval item a stop already resolved still waits on (a stop skipped before items were withdrawn, D-P11-6): withdrawn now. A
     * late decision on that stop reaches it through the stop door, which still answers `stop_closed`. Nothing for any other stop.
     */
    async leftoverWithdrawn(ref: StopRunRef, stepKey: string, context: Pick<StopCardContext, "locale">): Promise<boolean> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop?.state !== "resolved") return false
        return this.withdraw(ref.workspaceId, stop, "stop_closed_earlier", context.locale)
    }

    /**
     * The run was closed by the engine while stops of it stood open (a pinned version that can no longer run): every open stop resolves
     * and its card is rewritten as resolved, so no button stays live on a run that reads failed. Answers how many it closed.
     */
    async runClosed(ref: StopRunRef, context: Pick<StopCardContext, "locale">): Promise<number> {
        const open = (await this.records.ofRun(ref.workspaceId, ref.runId)).filter((stop) => stop.state === "open")
        const now = this.clock.now().toISOString()
        let closed = 0
        for (const stop of open) {
            const resolved = await this.records.patch(ref.workspaceId, stop.id, (fresh) =>
                fresh.state === "open" ? { state: "resolved", resolvedAt: now } : null,
            )
            if (resolved === null) continue
            closed += 1
            await this.cards.resolved(ref.workspaceId, resolved, context.locale, now)
            await this.withdraw(ref.workspaceId, resolved, "run_closed", context.locale)
        }
        return closed
    }

    /** The step of an open stop completed: the stop resolves and its card says so. Nothing happens for a step with no open stop. */
    async completed(ref: StopRunRef, stepKey: string, context: Pick<StopCardContext, "locale">): Promise<void> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop?.state !== "open") return
        const now = this.clock.now().toISOString()
        const resolved = await this.records.patch(ref.workspaceId, stop.id, (fresh) =>
            fresh.state === "open" ? { state: "resolved", resolvedAt: now } : null,
        )
        if (resolved === null) return
        await this.cards.resolved(ref.workspaceId, resolved, context.locale, now)
        await this.withdraw(ref.workspaceId, resolved, "step_completed", context.locale)
    }

    /** Keeps a line the stopped step sent a customer while its stop is open; nothing for a step with no open stop. */
    async lineSent(ref: StopRunRef, stepKey: string, line: RunStopCustomerLine): Promise<void> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop?.state !== "open") return
        await this.records.patch(ref.workspaceId, stop.id, (fresh) =>
            fresh.state !== "open" || fresh.customerLines.some((one) => one.conversationId === line.conversationId && one.at === line.at)
                ? null
                : { customerLines: [...fresh.customerLines, line], ...toldCustomerOf(fresh, [line]) },
        )
    }

    /** Whether the per-stop guard refuses a customer send of the step to this conversation now; null when the send may go. */
    async sendRefusal(ref: StopRunRef, stepKey: string, conversationId: string): Promise<StopSendRefusal | null> {
        return stopSendRefusalOf(await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey), conversationId)
    }

    /** The stop of a step, or null. */
    stopOf(ref: StopRunRef, stepKey: string): Promise<OptionalRunStop> {
        return this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
    }

    /** The stop with the customer sends its step made, as the ledger kept them; the stop as it is when the ledger adds none. */
    private async withSends(workspaceId: string, stop: RunStop): Promise<RunStop> {
        if (this.ledger === undefined) return stop
        const sends = await this.ledger.recordsOf(workspaceId, { runId: stop.runId, stepKey: stop.stepKey }, [
            TOOL.customerMessageSend,
        ])
        if (sends.length === 0) return stop
        const filled = await this.records.patch(workspaceId, stop.id, (fresh) => {
            const lines = linesWithSendsOf(fresh.customerLines, sends)
            const told = toldCustomerOf(fresh, lines ?? fresh.customerLines, sends)
            if (lines === null && told === null) return null
            return { ...(lines === null ? {} : { customerLines: lines }), ...told }
        })
        return filled ?? stop
    }

    /**
     * Withdraws the owner's item an approval stop still waits on: the stop keeps the verdict `withdrawn` FIRST (so the item's performer,
     * told of the rejection, finds the stop no longer waiting on it and moves nothing), then the work engine closes the item rejected by
     * the engine with the reason as its note. An item already decided (or gone) stays as it is. True when an item was withdrawn.
     */
    private async withdraw(workspaceId: string, stop: RunStop, by: WithdrawnBy, locale: StopCardContext["locale"]): Promise<boolean> {
        const workItemId = approvalItemWaitingOf(stop)
        if (workItemId === null || this.work === undefined) return false
        const marked = await this.records.patch(workspaceId, stop.id, (fresh) =>
            approvalItemWaitingOf(fresh) === workItemId ? { detail: { ...fresh.detail, facts: withdrawnFactsOf(fresh) } } : null,
        )
        if (marked === null) return false
        try {
            await this.work.resumeWork(
                { workspaceId, actor: ENGINE_ACTOR, locale },
                workItemId,
                "rejected",
                {},
                { name: ENGINE_ACTOR, kind: "staff" },
                `withdrawn:${by}`,
            )
            return true
        } catch {
            // Decided by a person meanwhile, or no longer waiting: that decision stands; the stop no longer waits on it either way.
            return false
        }
    }

    private async required(ref: StopRunRef, stepKey: string): Promise<RunStop> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop === null) throw new RunStopsError({ code: RunStopsErrorCode.NotFound })
        return stop
    }
}
