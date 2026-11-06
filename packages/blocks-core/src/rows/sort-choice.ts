import type { SpecText } from "@nivo-lite/agent-sdk/schema"

/** One option of a sort control as the spec lists it. */
export interface SortOptionSpec {
    /** The value the param takes. */
    readonly value: string
    /** The words of the option. */
    readonly label: SpecText
}

/** One option of a sort control with its words in the viewer's language. */
export interface SortChoice {
    /** The value the param takes. */
    readonly value: string
    /** The words of the option. */
    readonly label: string
}

/** The options of a sort control in the viewer's language. */
export const sortChoicesOf = (
    options: ReadonlyArray<SortOptionSpec>,
    words: (text: SpecText) => string,
): ReadonlyArray<SortChoice> => options.map((option) => ({ value: option.value, label: words(option.label) }))

/** The option the param's value names, else the first: a control always shows one choice. Null for a control with no options. */
export const chosenSort = (choices: ReadonlyArray<SortChoice>, value: string | null): SortChoice | null =>
    choices.find((choice) => choice.value === value) ?? choices[0] ?? null

/** The text of the control's trigger: its label, then the chosen option. */
export const sortTriggerText = (label: string, chosen: SortChoice): string => `${label}: ${chosen.label}`
