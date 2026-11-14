import type {
    TeamChatBrainChange,
    TeamChatBrainChangeButtonView,
    TeamChatBrainChangeQuoteView,
    TeamChatBrainChangeRowView,
    TeamChatBrainChangeView,
    TeamChatMarkView,
    TeamChatStopChipTone,
} from "@/modules/types"

/** Every word a truth-change card needs, in the viewer's language. */
export interface BrainChangeWords {
    readonly titleOf: (kind: string) => string
    readonly chipOf: (state: string) => { readonly label: string; readonly tone: TeamChatStopChipTone }
    readonly current: string
    /** "Will apply from 12/11": the value is a plan that starts at the day (shop time). */
    readonly plannedFrom: (date: string) => string
    readonly maybeReplaces: string
    readonly proposed: string
    readonly retired: string
    /** "version 2 · Delivery rules.docx". */
    readonly versionOf: (version: number | null, source: string) => string
    readonly reason: string
    readonly rowsLabel: string
    readonly quotesLabel: string
    readonly traceLabel: string
    readonly approve: string
    readonly reject: string
    readonly keepBoth: string
    /** "Pressed Agree" for the action that closed the card. */
    readonly pressedOf: (state: string) => string | null
    readonly supersededNote: string
    /** The muted line of a card: "Sales · from chat · 17:40". */
    readonly metaOf: (origin: string, agent: string, time: string) => string
    readonly saidBy: (name: string, when: string) => string
    readonly learnedFrom: (count: number) => string
    readonly timeOf: (iso: string) => string
    /** The day and the clock ("08/11 18:20"). */
    readonly dateTimeOf: (iso: string) => string
    /** The day of a moment in the shop's own time ("12/11"). */
    readonly shopDateOf: (iso: string) => string
}

const SEPARATOR = " · "

/** The key of a truth: what it is about, and which of its attributes. */
interface FactKeyLabels {
    readonly subjectLabel: string
    readonly attributeLabel: string
}

/** Who sent the card and when: the muted line is made from them. */
interface ChangeSender {
    readonly name: string
    readonly time: string
}

/** The value as one phrase: a unit that the value does not already say follows it. */
const valueOf = (value: string, unit: string | null): string =>
    unit === null || unit.trim() === "" || value.includes(unit) ? value : `${value} ${unit}`

/** The key of the truth: its subject, then its attribute. */
const keyOf = (key: FactKeyLabels): string =>
    [key.subjectLabel, key.attributeLabel].filter((part) => part !== "").join(SEPARATOR)

/** The name of the row of the value now: a plan that starts later, another truth of nearly the same meaning, or the value in force. */
const rowNameOf = (current: NonNullable<TeamChatBrainChange["current"]>, words: BrainChangeWords): string => {
    if (current.startsAt !== null) return words.plannedFrom(words.shopDateOf(current.startsAt))
    return current.match === "near" ? words.maybeReplaces : words.current
}

/** The row of the value now in force (or about to be, or of another truth that nearly means the same). */
const currentRowOf = (change: TeamChatBrainChange, words: BrainChangeWords): TeamChatBrainChangeRowView | null => {
    const { current } = change
    if (current === null) return null
    const isNear = current.match === "near"
    const isPlan = current.startsAt !== null
    const name = rowNameOf(current, words)
    const nearKey = isNear && current.factKey !== null ? keyOf(current.factKey) : ""
    const source = words.versionOf(current.version, current.source)
    return {
        id: "current",
        name,
        value: current.value,
        isReplaced: !isNear && !isPlan,
        note: [nearKey, source].filter((part) => part !== "").join(SEPARATOR),
    }
}

/** The row of the proposed value and where it comes from. */
const proposedRowOf = (change: TeamChatBrainChange, words: BrainChangeWords): TeamChatBrainChangeRowView => {
    const first = change.evidence[0]
    const note = (() => {
        if (change.origin === "learning") return change.evidence.length === 0 ? null : words.learnedFrom(change.evidence.length)
        if (first === undefined) return null
        return change.origin === "chat" && first.at !== null ? words.saidBy(first.by.name, words.dateTimeOf(first.at)) : first.by.name
    })()
    return {
        id: "proposed",
        name: words.proposed,
        value: change.kind === "retire" ? words.retired : valueOf(change.newValue, change.unit),
        isReplaced: false,
        note,
    }
}

/** The quotes of the evidence, oldest first; only when there are several (one quote is the reason's own). */
const quotesOf = (change: TeamChatBrainChange, words: BrainChangeWords): ReadonlyArray<TeamChatBrainChangeQuoteView> =>
    change.evidence.length < 2
        ? []
        : change.evidence.map((item, index) => ({
              id: `${String(index)}-${item.quote}`,
              quote: `“${item.quote}”`,
              line: item.at === null ? item.by.name : `${item.by.name}${SEPARATOR}${words.dateTimeOf(item.at)}`,
          }))

/** The buttons the viewer may press: exactly what the door says `canApprove` / `canReject` / `canKeepBoth`, and only while open. */
const buttonsOf = (change: TeamChatBrainChange, words: BrainChangeWords): ReadonlyArray<TeamChatBrainChangeButtonView> =>
    change.state !== "open"
        ? []
        : [
              ...(change.canApprove ? [{ action: "approve" as const, label: words.approve, kind: "primary" as const }] : []),
              ...(change.canReject ? [{ action: "reject" as const, label: words.reject, kind: "neutral" as const }] : []),
              ...(change.canKeepBoth ? [{ action: "keep_both" as const, label: words.keepBoth, kind: "neutral" as const }] : []),
          ]

/** The line after the key once a change was put in force: "old value, arrow, new value" (just the new value for a new truth). */
const settledLineOf = (change: TeamChatBrainChange): string => {
    const next = change.kind === "retire" ? "" : valueOf(change.newValue, change.unit)
    const previous = change.current?.value ?? change.oldValue
    if (next === "") return ""
    return previous === null || previous === "" ? next : `${previous} → ${next}`
}

/**
 * The truth-change card of a message with every word resolved. While open it shows the key, the bordered list of the value now and the
 * value proposed, the reason and the evidence, and exactly the buttons the viewer may press. Once the change was put in force the card
 * is rewritten in place: the key with the old value, an arrow, the new value, no list, and the trace of who pressed what. The words and the buttons are the web's;
 * the back end sends only values and the viewer's flags.
 */
export const brainChangeViewOf = (
    change: TeamChatBrainChange,
    words: BrainChangeWords,
    mark: TeamChatMarkView,
    sender: ChangeSender,
): TeamChatBrainChangeView => {
    const isApplied = change.state === "applied"
    const key = keyOf(change.factKey)
    const settled = isApplied ? settledLineOf(change) : ""
    const pressed = change.decidedBy === null ? null : words.pressedOf(change.state)
    const current = currentRowOf(change, words)
    return {
        changeId: change.changeId,
        revision: change.revision,
        mark,
        meta: words.metaOf(change.origin, sender.name, sender.time),
        title: words.titleOf(change.kind),
        chip: words.chipOf(change.state),
        keyLine: settled === "" ? key : `${key}: ${settled}`,
        rows: isApplied ? [] : [...(current === null ? [] : [current]), proposedRowOf(change, words)],
        rowsLabel: words.rowsLabel,
        reason: change.reason.trim() === "" || isApplied ? null : { label: words.reason, text: change.reason.trim() },
        quotes: isApplied ? [] : quotesOf(change, words),
        quotesLabel: words.quotesLabel,
        buttons: buttonsOf(change, words),
        trace:
            pressed === null || change.decidedBy === null
                ? null
                : { title: pressed, line: `${change.decidedBy.name}${SEPARATOR}${words.timeOf(change.decidedBy.at)}` },
        traceLabel: words.traceLabel,
        note: change.state === "superseded" ? words.supersededNote : null,
    }
}
