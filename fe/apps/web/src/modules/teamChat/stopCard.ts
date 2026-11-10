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
    readonly timedOut: string
    readonly done: string
    readonly takenOver: string
}

/** Every word a stop card needs, in the viewer's language. */
export interface StopCardWords {
    readonly labels: TeamChatStopLabels
    readonly chips: StopCardChipWords
    /** What each reply kind did, after the replier's name ("answered", "pressed Retry"). */
    readonly replies: Readonly<Record<Exclude<TeamChatStopReplyKind, "timeout">, string>>
    /** The line of a reply a NIVO deadline gave. */
    readonly timedOutReply: string
    /** "time N" after the meta line of a step that stopped more than once. */
    readonly repeats: (count: number) => string
    /** The names of the account and ability lines of a leave request. */
    readonly account: string
    readonly ability: string
    readonly timeOf: (iso: string) => string
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
    const did = `${reply.byName} ${words.replies[reply.kind]}`
    const text = reply.text?.trim() ?? ""
    return text === "" ? { id, title: did, line: at } : { id, title: `“${text}”`, line: `${did}${SEPARATOR}${at}` }
}

/** Name/value rows, keyed by place (a fact name may repeat). */
const linesOf = (facts: ReadonlyArray<{ readonly name: string; readonly value: string }>): ReadonlyArray<TeamChatStopLineView> =>
    facts.map((fact, index) => ({ id: `${String(index)}-${fact.name}`, name: fact.name, value: fact.value }))

/**
 * The stop card of a message with every word resolved. The controls are exactly what `needs` says the engine accepts now (nothing on a
 * card that ended); suggestions only while it is open; the facts stay apart, folded by the card, because they may carry raw codes.
 */
export const stopCardViewOf = (stop: TeamChatStop, words: StopCardWords, mark: TeamChatMarkView): TeamChatStopCardView => {
    const meta = [stop.workflowTitle, stop.stepTitle, words.timeOf(stop.stoppedAt)].filter((part) => part !== "")
    const approval = stop.approval
    return {
        runId: stop.runId,
        stepKey: stop.stepKey,
        key: stopKeyOf(stop),
        mark,
        revision: stop.revision,
        meta: [...meta, ...(stop.repeats > 1 ? [words.repeats(stop.repeats)] : [])].join(SEPARATOR),
        chip: chipOf(stop, words.chips),
        headline: stop.headline,
        message: stop.message,
        question: stop.question,
        suggestions: stop.state === "open" ? stop.suggestions.map((suggestion) => suggestion.text) : [],
        canAnswer: stop.needs.answer,
        answerPlaceholder: stop.kind === "ai_error" ? words.labels.contextPlaceholder : words.labels.answerPlaceholder,
        decisions: stop.needs.decisions,
        verdicts: approval === null ? [] : stop.needs.verdicts,
        approval:
            approval === null
                ? null
                : {
                      workItemId: approval.workItemId,
                      lines: linesOf([
                          { name: words.account, value: approval.account },
                          { name: words.ability, value: approval.ability },
                          ...approval.args,
                      ]),
                  },
        facts: linesOf(stop.facts),
        replies: stop.replies.map((reply, index) => replyOf(reply, index, words)),
        labels: words.labels,
    }
}

/** The key of the card an action is in flight on: its run and step. */
const stopKeyOf = (card: Pick<TeamChatStop, "runId" | "stepKey">): string => `${card.runId}:${card.stepKey}`
