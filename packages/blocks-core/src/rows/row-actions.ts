import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { CommandIntent } from "./decision-commands"

/** The action slots a record list offers for the commands of its rows, each bound by the spec to one action. */
export const ROW_ACTION_SLOTS = ["action1", "action2", "action3", "action4"] as const

/** One of the action slots of a record list. */
export type RowActionSlot = (typeof ROW_ACTION_SLOTS)[number]

/** The key of the single `open` action when a row's own choice names it. */
export const OPEN_KEY: "open" = "open"

/** How the pill of a row command looks: the look its declared intent gives it. */
export type RowActionLook = "commit" | "alternative" | "dismiss" | "neutral" | "destructive"

/** One command of a row as the spec declares it: the action slot it runs, the key a row names it by, and its words and look. */
export interface RowActionDeclared {
    /** The action slot that runs it. */
    readonly slot: RowActionSlot
    /** The value a row's action field takes to choose it; the name of the slot when absent. */
    readonly key?: string | undefined
    /** The words on the pill; the label of the bound action when absent. */
    readonly label?: SpecText | undefined
    /** The look of the pill; neutral when absent. */
    readonly intent?: CommandIntent | undefined
}

/** What a bound slot says of itself. */
export interface RowActionSource {
    /** Whether the viewer may run it. */
    readonly isAllowed: boolean
    /** The words of the bound action. */
    readonly label: string
}

/** One command a record list may draw under a row: which slot runs it and how the pill reads. */
export interface RowActionOffer {
    /** The value a row's action field takes to choose it. */
    readonly key: string
    /** The slot that runs it; `open` is the single action of the list. */
    readonly slot: RowActionSlot | typeof OPEN_KEY
    /** The words on the pill. */
    readonly label: string
    /** The look of the pill. */
    readonly look: RowActionLook
}

/** The look of a declared intent: the danger intent is the destructive pill, and an undeclared one is the plain pill. */
export const lookOf = (intent: CommandIntent | undefined): RowActionLook => {
    if (intent === undefined) return "neutral"
    return intent === "danger" ? "destructive" : intent
}

/** The single `open` action as a command, when the viewer may run it. */
const openOffer = (open: RowActionSource): ReadonlyArray<RowActionOffer> =>
    open.isAllowed ? [{ key: OPEN_KEY, slot: OPEN_KEY, label: open.label, look: "neutral" }] : []

/**
 * The commands a list may offer: the declared ones the viewer may run, in the order the spec gives them, each with the words the
 * spec gives it or else the words of its bound action; then the single `open` action when the viewer may run it.
 */
export const offersOf = (
    declared: ReadonlyArray<RowActionDeclared>,
    source: (slot: RowActionSlot) => RowActionSource,
    open: RowActionSource,
    words: (text: SpecText) => string,
): ReadonlyArray<RowActionOffer> => [
    ...declared.flatMap((entry): ReadonlyArray<RowActionOffer> => {
        const bound = source(entry.slot)
        if (!bound.isAllowed) return []
        return [
            {
                key: entry.key ?? entry.slot,
                slot: entry.slot,
                label: entry.label === undefined ? bound.label : words(entry.label),
                look: lookOf(entry.intent),
            },
        ]
    }),
    ...openOffer(open),
]

/**
 * The command a row draws. A list with a choice field (`choice` is the row's value, possibly empty) draws the command the value
 * names, and none when it names none the viewer may run; a list with no choice field draws its first command on every row.
 */
export const offerFor = (offers: ReadonlyArray<RowActionOffer>, choice: string | undefined): RowActionOffer | null =>
    choice === undefined ? (offers[0] ?? null) : (offers.find((offer) => offer.key === choice) ?? null)
