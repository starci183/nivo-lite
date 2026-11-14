import type { ReactNode } from "react"
import type { AgentMessagePreview } from "@nivo-lite/agent-sdk/team-chat"
import type {
    TeamChatMarkView,
    TeamChatStop,
    TeamChatStopCardView,
    TeamChatStopChipTone,
    TeamChatStopLabels,
    TeamChatStopLineView,
    TeamChatStopReplyKind,
    TeamChatStopReplyView,
} from "@/modules/types"

/** The words of the state chips a stop card wears (the web owns them; the engine sends the headline). */
interface StopCardChipWords {
    /** Open, asked by the AI. */
    readonly needsYou: string
    /** Open, written by NIVO (the AI itself failed). */
    readonly nivoReports: string
    readonly answered: string
    readonly skipped: string
    /** The founder gave the conversation back to the AI after a take-over. */
    readonly handedBack: string
    readonly timedOut: string
    readonly done: string
    readonly takenOver: string
}

/** The stop a preview is drawn for: the key of its card and its head. */
export interface StopPreviewTarget {
    readonly id: string
    readonly title: string
}

/** Every word a stop card needs, in the viewer's language. */
export interface StopCardWords {
    readonly labels: TeamChatStopLabels
    readonly chips: StopCardChipWords
    /** What each reply kind did, after the replier's name ("answered", "pressed Retry"). */
    readonly replies: Readonly<Record<Exclude<TeamChatStopReplyKind, "timeout">, string>>
    /** The title of the trace row of a verdict on a leave request ("Agreed", "Refused"); the replier and the time follow in the line. */
    readonly verdicts: { readonly approve: string; readonly refuse: string }
    /** The line of a reply a NIVO deadline gave. */
    readonly timedOutReply: string
    /** "time N" after the meta line of a step that stopped more than once. */
    readonly repeats: (count: number) => string
    /** The names of the account and ability lines of a leave request. */
    readonly account: string
    readonly ability: string
    readonly timeOf: (iso: string) => string
    /** Draws the preview a package gave the stop through the view registered for its kind (nothing when it cannot): the hooks layer owns the registry. */
    readonly previewOf: (preview: AgentMessagePreview | null, stop: StopPreviewTarget) => ReactNode
}

const SEPARATOR = " · "

/** The last reply was a take-over and the card still waits on the step: the founder is talking to the customer by hand. */
const isTakenOver = (stop: TeamChatStop): boolean =>
    stop.replies.at(-1)?.kind === "take_over" && (stop.state === "open" || (stop.state === "answered" && stop.resolvedAt === null))

/** The chip of the card: who asks while it is open, else how it ended. */
const chipOf = (stop: TeamChatStop, words: StopCardChipWords): { readonly label: string; readonly tone: TeamChatStopChipTone } => {
    if (isTakenOver(stop)) return { label: words.takenOver, tone: "warning" }
    switch (stop.state) {
        case "open":
            return stop.by === "engine" ? { label: words.nivoReports, tone: "neutral" } : { label: words.needsYou, tone: "accent" }
        case "answered":
            return stop.resolvedAt === null ? { label: words.answered, tone: "success" } : { label: words.done, tone: "success" }
        case "skipped":
            return { label: words.skipped, tone: "neutral" }
        case "handed_back":
            return { label: words.handedBack, tone: "neutral" }
        case "timed_out":
            return { label: words.timedOut, tone: "neutral" }
        case "resolved":
            return { label: words.done, tone: "success" }
    }
}

/** One reply of the trace: the words said (quoted) or what was pressed, then who and when. */
const replyOf = (
    reply: TeamChatStop["replies"][number],
    index: number,
    words: StopCardWords,
): TeamChatStopReplyView => {
    const id = `${reply.at}-${String(index)}`
    const at = words.timeOf(reply.at)
    if (reply.kind === "timeout") return { id, title: words.timedOutReply, line: at }
    if (reply.kind === "approve" || reply.kind === "refuse") {
        return { id, title: words.verdicts[reply.kind], line: `${reply.byName}${SEPARATOR}${at}` }
    }
    const did = `${reply.byName} ${words.replies[reply.kind]}`
    const text = reply.text?.trim() ?? ""
    return text === "" ? { id, title: did, line: at } : { id, title: `“${text}”`, line: `${did}${SEPARATOR}${at}` }
}

/** Name/value rows, keyed by place (a fact name may repeat). */
const linesOf = (facts: ReadonlyArray<{ readonly name: string; readonly value: string }>): ReadonlyArray<TeamChatStopLineView> =>
    facts.map((fact, index) => ({ id: `${String(index)}-${fact.name}`, name: fact.name, value: fact.value }))

/** The pieces of one kind the approved call carries in full (`text`: the words; `address`: a picture or file); none when the card has none. */
const contentOf = (stop: TeamChatStop, kind: "text" | "address"): ReadonlyArray<{ readonly name: string; readonly value: string }> =>
    (stop.decision?.content ?? []).filter((item) => item.kind === kind)

/** The head of a stop: "Workflow stopped · {workflow} › {step}"; a leave request keeps the engine's own headline (it names who asks for what). */
const headOf = (stop: TeamChatStop, words: StopCardWords): string => {
    if (stop.kind === "approval") return stop.headline
    const where = [stop.workflowTitle, stop.stepTitle].filter((part) => part !== "").join(" › ")
    return where === "" ? words.labels.title : `${words.labels.title}${SEPARATOR}${where}`
}

/** What the card lists as content: the worded facts, then how many times and when the step stopped (a leave request lists its own lines instead). */
const listedOf = (stop: TeamChatStop, words: StopCardWords): ReadonlyArray<TeamChatStopLineView> => {
    const worded = linesOf(stop.facts.filter((fact) => fact.technical !== true))
    if (stop.kind === "approval") return worded
    const stops = { id: "stops", name: words.labels.stopsRow, value: `${String(stop.repeats)}${SEPARATOR}${words.timeOf(stop.stoppedAt)}` }
    return [...worded, stops]
}

/**
 * The stop card of a message with every word resolved. The controls are exactly what `needs` says the engine accepts now (nothing on a
 * card that ended); suggestions only while it is open; the worded facts are the card's bordered list and the raw ones (codes, ids) stay
 * apart, folded by the card under "Technical details".
 */
export const stopCardViewOf = (stop: TeamChatStop, words: StopCardWords, mark: TeamChatMarkView): TeamChatStopCardView => {
    const meta = [words.timeOf(stop.stoppedAt)]
    const approval = stop.approval
    const held = isTakenOver(stop) ? (stop.conversationId ?? null) : null
    return {
        runId: stop.runId,
        stepKey: stop.stepKey,
        key: stopKeyOf(stop),
        mark,
        revision: stop.revision,
        meta: [...meta, ...(stop.repeats > 1 ? [words.repeats(stop.repeats)] : [])].join(SEPARATOR),
        chip: chipOf(stop, words.chips),
        headline: headOf(stop, words),
        message: stop.message,
        question: stop.question,
        suggestions: stop.state === "open" ? stop.suggestions.map((suggestion) => suggestion.text) : [],
        // A leave request is answered by its verdicts alone: never a words box, never "Thu lai" (the door would refuse it as approval_pending).
        canAnswer: approval === null && stop.needs.answer,
        answerPlaceholder: stop.kind === "ai_error" ? words.labels.contextPlaceholder : words.labels.answerPlaceholder,
        // While the viewer holds the customer the card offers the way back, not another take-over.
        decisions: approval === null ? stop.needs.decisions.filter((decision) => !(decision === "take_over" && held !== null)) : [],
        verdicts: approval === null ? [] : stop.needs.verdicts,
        approval:
            approval === null
                ? null
                : {
                      workItemId: approval.workItemId,
                      messageLines: contentOf(stop, "text").flatMap((item) => item.value.split(/\r?\n/)),
                      files: contentOf(stop, "address").map((item) => item.value),
                      lines: linesOf([
                          { name: words.account, value: approval.account },
                          { name: words.ability, value: approval.ability },
                          ...approval.args,
                      ]),
                  },
        heldConversationId: held,
        facts: listedOf(stop, words),
        technical: linesOf(stop.facts.filter((fact) => fact.technical === true)),
        preview: words.previewOf(stop.preview ?? null, { id: stopKeyOf(stop), title: headOf(stop, words) }),
        replies: stop.replies.map((reply, index) => replyOf(reply, index, words)),
        labels: words.labels,
    }
}

/** The key of the card an action is in flight on: its run and step. */
const stopKeyOf = (card: Pick<TeamChatStop, "runId" | "stepKey">): string => `${card.runId}:${card.stepKey}`
