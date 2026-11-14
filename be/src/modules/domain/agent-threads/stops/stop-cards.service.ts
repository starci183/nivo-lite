import { Injectable, Optional } from "@nestjs/common"
import { STOPPED_DECISIONS, type WorkflowStoppedPayload } from "@nivo-lite/agent-sdk/team-chat"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import {
    LINE_FACT,
    NO_NEEDS,
    STOP_CARD_MESSAGE_KIND,
    type StopCardApproval,
    type StopCardKind,
    type StopCardNeeds,
    type StopCardReplyKind,
    type StopCardSectionGiven,
    type StopCardState,
} from "@modules/domain/team-chat"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import type { RunStop, StopCardContext } from "./run-stop.contracts"
import type { ApprovalCardPreview } from "../approval-card.policy"

/** The longest summary line of a card. */
const SUMMARY_MAX = 4000

/** The key every card of a step of a run is kept under, the same as the old engine's (`run-stuck:<run>:<step>`). */
export const stopCardKeyOf = (runId: string, stepKey: string): string => `run-stuck:${runId}:${stepKey}`

/** The turn the card is posted in: the agent of the run speaks, in the team's language, about no record of its own. */
const turnOf = (workspaceId: string, stop: RunStop, locale: StopCardContext["locale"]): NodeTurn => ({
    turnId: stop.runId,
    workspaceId,
    agentId: stop.agentId,
    subject: null,
    conversationId: stop.conversationId,
    locale,
})

/** Which of the founder's three stops a stop is: an engine-worded stop is NIVO's report, like an AI error. */
export const stopCardKindOf = (stop: Pick<StopCardSource, "kind">): StopCardKind => {
    if (stop.kind === "approval") return "approval"
    return stop.kind === "ai_report" ? "ai_report" : "ai_error"
}

/** What an open stop asks: a verdict for a permission request; the founder's words and the three buttons for any other stop. */
const openNeedsOf = (kind: StopCardKind): StopCardNeeds =>
    kind === "approval"
        ? { answer: false, decisions: [], verdicts: ["approve", "refuse"] }
        : { answer: true, decisions: [...STOPPED_DECISIONS], verdicts: [] }

/** What a stop a person took over still accepts: their words, a retry once they are done, or a skip. */
const TAKEN_OVER_NEEDS: StopCardNeeds = { answer: true, decisions: ["retry", "skip"], verdicts: [] }

/** The card's state of a stop as read from its record: where it stands, what the engine needs, and whether a person took it over. */
export interface StopCardRead {
    /** Where it stands. */
    readonly state: StopCardState
    /** What the engine needs now. */
    readonly needs: StopCardNeeds
    /** Whether the last decision was a take-over (the card says so). */
    readonly takenOver: boolean
}

/** The fields of a stop its card's state is read from. */
export type StopCardSource = Pick<RunStop, "kind" | "state" | "decision">

/** The card's state of a stop and what the engine needs now, read from the stop record alone. */
export const stopCardStateOf = (stop: StopCardSource): StopCardRead => {
    const decision = stop.decision?.kind ?? null
    if (stop.state === "resolved") {
        if (decision === "skip") return { state: "skipped", needs: NO_NEEDS, takenOver: false }
        if (decision === "timeout") return { state: "timed_out", needs: NO_NEEDS, takenOver: false }
        return { state: decision === null ? "resolved" : "answered", needs: NO_NEEDS, takenOver: false }
    }
    if (decision === null) return { state: "open", needs: openNeedsOf(stopCardKindOf(stop)), takenOver: false }
    if (decision === "take_over") return { state: "answered", needs: TAKEN_OVER_NEEDS, takenOver: true }
    if (decision === "timeout") return { state: "timed_out", needs: NO_NEEDS, takenOver: false }
    return { state: "answered", needs: NO_NEEDS, takenOver: false }
}

/** The catalog key of the heading of a stop in its state. */
const headlineKeyOf = (stop: RunStop, state: StopCardState, takenOver: boolean): string => {
    if (state === "open") return `teamChat.stopCard.open.${stop.kind}`
    if (takenOver) return "teamChat.stopCard.takenOver"
    if (state === "answered")
        return stop.resolvedAt === null ? "teamChat.stopCard.answered" : "teamChat.stopCard.answeredDone"
    if (state === "skipped") return "teamChat.stopCard.skipped"
    if (state === "timed_out") return "teamChat.stopCard.timedOut"
    return "teamChat.stopCard.resolved"
}

/** Engine facts of a permission request that name what it asks (shown in its `approval` part, never as arguments). */
const APPROVAL_FACTS = new Set(["workItemId", "tool", "account", "ability", "fingerprint", "verdict"])

/** Engine facts never shown on a card: keys of the machinery, not words for the founder. */
const HIDDEN_FACTS = new Set(["workItemId", "fingerprint", "verdict"])

/** The value of a named fact of a stop, or empty. */
const factOf = (stop: RunStop, name: string): string =>
    stop.detail.facts.find((fact) => fact.name === name)?.value ?? ""

/**
 * What a permission request asks to do, read from the stop's engine facts (written by the approval stop, package 1-3): the work
 * item its verdict goes through, the tool, the account, the ability, and every other fact as an argument. Null without a work item.
 */
export const approvalOf = (stop: RunStop): StopCardApproval | null => {
    const workItemId = factOf(stop, "workItemId")
    if (workItemId === "") return null
    return {
        workItemId,
        tool: factOf(stop, "tool"),
        account: factOf(stop, "account"),
        ability: factOf(stop, "ability"),
        args: stop.detail.facts
            .filter((fact) => !APPROVAL_FACTS.has(fact.name))
            .map((fact) => ({ name: fact.name, value: fact.value })),
    }
}

/**
 * What a reply on the card was. On a permission request the owner's verdict reaches the thread as a retry (approved) or as words
 * (refused: an approval stop takes no words of its own), so the trace names it `approve` / `refuse`: the decision, who and when, lives
 * on the card, never as a second line (D-MX-10, owner law stop-card-design).
 */
export const replyKindOf = (stop: Pick<RunStop, "kind">, kind: StopCardReplyKind): StopCardReplyKind => {
    if (stop.kind !== "approval") return kind
    if (kind === "retry") return "approve"
    return kind === "answer" ? "refuse" : kind
}

@Injectable()
/**
 * The card of a stop in the team chat: ONE message per step of a run, posted under the key the old engine used, then rewritten in place
 * for the stop's whole life (answered, taken over, skipped, timed out, resolved, stopped again) with the founder's replies kept on it.
 * Its typed part (`stop`: kind, state, needs, replies) is read from the stop record alone, so any writer of the record can rewrite it.
 * It carries the three decisions for every stop with a customer or without (a bank-fed run is answered on the same card), and a verdict
 * for a permission request. The words shown are engine words in the team's language; the facts stay out of the readable line.
 */
export class StopCardsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        // The node registry holds the team chat's post executor. An app with no node host (the mcp app answers a stop's verdict, which
        // writes no card: the api's drain rewrites it when it applies the answer) has none, and posts nothing, as with no executor.
        @Optional() private readonly nodes?: GraphNodeRegistryService,
    ) {}

    /** The typed part of the card of a stop as it stands now. */
    sectionOf(stop: RunStop, locale: StopCardContext["locale"]): StopCardSectionGiven {
        const { state, needs, takenOver } = stopCardStateOf(stop)
        return {
            version: 1,
            stopId: stop.id,
            runId: stop.runId,
            stepKey: stop.stepKey,
            kind: stopCardKindOf(stop),
            state,
            headline:
                stop.kind === "approval" && state === "open" && stop.reason !== ""
                    ? stop.reason
                    : this.catalog.get(headlineKeyOf(stop, state, takenOver), {}, locale),
            needs,
            replies: stop.answers.map((answer) => ({
                kind: replyKindOf(stop, answer.kind),
                text: answer.text,
                by: answer.by,
                at: answer.at,
            })),
            repeats: stop.repeats,
            stoppedAt: stop.stoppedAt,
            resolvedAt: stop.resolvedAt,
            approval: stop.kind === "approval" ? approvalOf(stop) : null,
        }
    }

    /** Posts the card of an open stop, or folds it into the card already there; answers the chat message id, or null when nothing posts. */
    async posted(workspaceId: string, stop: RunStop, context: StopCardContext, now: string): Promise<string | null> {
        const post = this.nodes?.optionalExecutorOf(TOOL.teamMessagePost)
        if (post === undefined) return null
        const section = this.sectionOf(stop, context.locale)
        const approvalCard = stop.detail.approvalCard
        const card: WorkflowStoppedPayload & {
            readonly stop: StopCardSectionGiven
            readonly preview?: ApprovalCardPreview | undefined
        } = {
            workflow: context.workflow,
            step: context.step,
            runId: stop.runId,
            // The engine names no sales lead: the stop is about a contact (the card payload keeps `leadId` for the readers that still take it).
            leadId: null,
            conversationId: stop.conversationId,
            by: context.by,
            reason: stop.reason,
            question: stop.question,
            facts: stop.detail.facts
                .filter((fact) => !HIDDEN_FACTS.has(fact.name))
                .map((fact) => ({ name: fact.name, value: fact.value })),
            suggestions: stop.detail.suggestions.map((one) => ({ text: one.text, handledBy: one.handledBy })),
            decisions: [...section.needs.decisions],
            repeats: stop.repeats,
            firstAt: now,
            lastAt: now,
            stop: section,
            ...(approvalCard?.preview === undefined ? {} : { preview: approvalCard.preview }),
        }
        // The readable line: the reason and the question only. The facts are the engine's raw values; the card shows them apart.
        const summary = [stop.reason, stop.question ?? ""].filter((part) => part !== "").join("\n")
        const key = stopCardKeyOf(stop.runId, stop.stepKey)
        const payload = {
            kind: STOP_CARD_MESSAGE_KIND,
            title: section.headline,
            summary: summary.slice(0, SUMMARY_MAX),
            card,
            // The approval card the engine built before the write (agent-sdk `approval.decision`'s payload), on a permission request.
            ...(approvalCard === undefined ? {} : { decision: approvalCard }),
        }
        const subject = await post.execute(turnOf(workspaceId, stop, context.locale), payload, {
            key: `${key}:${String(stop.repeats)}`,
            dedupeKey: key,
        })
        return subject.kind === "chat-message" ? subject.id : null
    }

    /**
     * Rewrites the card of a stop in place to the state its record holds now (an answer, a take-over, a deadline, a skip, the resolution),
     * keeping every reply on it. Nothing posts when the stop never had a card: a rewrite never makes a second card.
     */
    async rewritten(workspaceId: string, stop: RunStop, locale: StopCardContext["locale"]): Promise<void> {
        const post = this.nodes?.optionalExecutorOf(TOOL.teamMessagePost)
        if (post === undefined || stop.cardMessageId === null) return
        const section = this.sectionOf(stop, locale)
        const key = stopCardKeyOf(stop.runId, stop.stepKey)
        const summary = [section.headline, stop.reason].join("\n")
        // What the record says about the engine's holding line (not told to the customer, and why) travels with every rewrite, raw:
        // the team chat words it on the card, so the card never stays silent about a line the send refused.
        const lineFacts = stop.detail.facts
            .filter((fact) => fact.name === LINE_FACT.told || fact.name === LINE_FACT.reason)
            .map((fact) => ({ name: fact.name, value: fact.value }))
        const notTold = lineFacts.find((fact) => fact.name === LINE_FACT.reason)?.value
        const payload = {
            kind: STOP_CARD_MESSAGE_KIND,
            rewrite: { title: section.headline, summary: summary.slice(0, SUMMARY_MAX), stop: section, lineFacts },
            ...(stop.detail.approvalCard === undefined ? {} : { decision: stop.detail.approvalCard }),
        }
        // A fact added to an open stop (a credit that joined its run, D-MX-3) rewrites the card too: the key counts the facts, and
        // names the reason a holding line was not told (a second refusal for another reason is another write).
        const written = `f${String(stop.detail.facts.length)}${notTold === undefined ? "" : `:${notTold}`}`
        await post.execute(turnOf(workspaceId, stop, locale), payload, {
            key: `${key}:${section.state}:${String(stop.repeats)}:${String(stop.answers.length)}:${written}`,
            dedupeKey: key,
        })
    }

    /** Rewrites the card of a resolved stop in place (its state read from the record). Nothing posts when there was none. */
    async resolved(workspaceId: string, stop: RunStop, locale: StopCardContext["locale"], now: string): Promise<void> {
        await this.rewritten(workspaceId, stop.resolvedAt === null ? { ...stop, resolvedAt: now } : stop, locale)
    }
}
