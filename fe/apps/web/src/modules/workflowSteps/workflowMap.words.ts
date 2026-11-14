import en from "./mapWords/en.json"
import vi from "./mapWords/vi.json"

/** The two languages the map's own words are written in. */
type MapLocale = "vi" | "en"

/**
 * The words the map writes itself. A step's title, a condition's question, a loop's name and its two ways out come from the graph (and the
 * package view's own words for a step that names none); only what the map composes from a wait's params, and its frame and legend, is here.
 */
export interface MapWords {
    /** The port words of a group of customer messages that lead to the same step. */
    readonly customerMessages: string
    /** The words of what a wait waits for: its list of events, and the longest it waits. */
    readonly waitLine: (events: string, limit: string) => string
    readonly limit: (amount: number, unit: "minute" | "hour" | "day") => string
    /** The muted text after a loop frame's name: how many rounds it runs at most. */
    readonly rounds: (max: number) => string
    /** The muted line inside a loop frame: the body goes round from its first step while no way out holds. */
    readonly repeat: string
    /** The legend entry of the loop frame. */
    readonly legendLoop: string
    /** The owner's words of each trigger verb a wait listens for, for a route the package view has no words for. */
    readonly verbs: Readonly<Record<string, string>>
}

/** A message with its `{name}` holes filled. */
const filled = (message: string, values: Readonly<Record<string, string | number>>): string =>
    message.replaceAll(/\{(\w+)\}/g, (hole, name: string) => String(values[name] ?? hole))

const wordsOf = (messages: typeof vi): MapWords => ({
    customerMessages: messages.customerMessages,
    waitLine: (events, limit) => filled(messages.waitLine, { events, limit }),
    limit: (amount, unit) =>
        filled({ minute: messages.limitMinute, hour: messages.limitHour, day: messages.limitDay }[unit], { amount }),
    rounds: (max) => filled(messages.rounds, { max }),
    repeat: messages.repeat,
    legendLoop: messages.legendLoop,
    verbs: messages.verbs,
})

const VI = wordsOf(vi)
const EN = wordsOf(en)

/** The words of the map in one language. */
export const mapWordsOf = (locale: MapLocale): MapWords => (locale === "en" ? EN : VI)
