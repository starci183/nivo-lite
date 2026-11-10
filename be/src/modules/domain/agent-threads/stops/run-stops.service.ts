import { Injectable, Optional } from "@nestjs/common"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import type { RunStopCustomerLine } from "@nivo-lite/blocks-core/entities"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { RunStopsError, RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import type {
    OptionalRunStop,
    RunStop,
    StopCardContext,
    StopOpen,
    StopQuestion,
    StopRoute,
    StopSendRefusal,
} from "./run-stop.contracts"
import { StopCardsService } from "./stop-cards.service"
import { answerIndexOf, stopAnswerOf, stopDecisionOf, stopQuestionOf, stopRouteOf, stopSendRefusalOf } from "./stop-gate.policy"

/** The run a stop belongs to. */
export interface StopRunRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
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

@Injectable()
/**
 * The stops of thread runs: the one mechanism for every run that cannot go on by itself, with a customer or without. A step that cannot
 * complete opens the stop of its run and step (`stopped`): one record, one card in the team chat (the same message for every stop of
 * that step, rewritten in place), and the question the gate node hands `scope.stop`. A decision (`decide`: the founder's words, a button
 * or a deadline) is kept on the stop and routed by the gate: back to the step with every word given, back to the gate, or to the end.
 * The stop resolves when the step then completes (`completed`), or at once on `skip`, and its card says so. While it is open, a customer
 * the stopped step already told is not told again until the founder answers in words (`sendRefusal`, read by the send door). What the
 * customer was told is kept on the stop (`customerLines`): the engine's own line (`lineSent`) and, each time the stop opens, the
 * customer sends of its step that the effect ledger kept (D.1), whatever conversation they went to.
 */
export class RunStopsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly records: RunStopRecordsService,
        private readonly cards: StopCardsService,
        @Optional() private readonly ledger?: GraphNodeEffectsService,
    ) {}

    /** Opens the stop of a step (or opens it again), posts or folds its card, and answers the question the gate hands `scope.stop`. */
    async stopped(input: StopOpen): Promise<StopQuestion> {
        const now = this.clock.now().toISOString()
        const stop = await this.withSends(input.workspaceId, await this.records.open(input, now))
        const messageId = await this.cards.posted(input.workspaceId, stop, input.card, now)
        if (messageId === null || messageId === stop.cardMessageId) return stopQuestionOf(stop)
        const carded = await this.records.patch(input.workspaceId, stop.id, (fresh) =>
            fresh.cardMessageId === messageId ? null : { cardMessageId: messageId },
        )
        return stopQuestionOf(carded ?? stop)
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
        return route
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
        if (resolved !== null) await this.cards.resolved(ref.workspaceId, resolved, context.locale, now)
    }

    /** Keeps a line the stopped step sent a customer while its stop is open; nothing for a step with no open stop. */
    async lineSent(ref: StopRunRef, stepKey: string, line: RunStopCustomerLine): Promise<void> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop?.state !== "open") return
        await this.records.patch(ref.workspaceId, stop.id, (fresh) =>
            fresh.state !== "open" || fresh.customerLines.some((one) => one.conversationId === line.conversationId && one.at === line.at)
                ? null
                : { customerLines: [...fresh.customerLines, line] },
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
            return lines === null ? null : { customerLines: lines }
        })
        return filled ?? stop
    }

    private async required(ref: StopRunRef, stepKey: string): Promise<RunStop> {
        const stop = await this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        if (stop === null) throw new RunStopsError({ code: RunStopsErrorCode.NotFound })
        return stop
    }
}
