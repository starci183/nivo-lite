import type { SpecText } from "@nivo-lite/agent-sdk/schema"

/** The words of a pick: the overlay that lists the options one of which the person chooses. */
export interface PickChoice {
    /** The name the chosen id is sent under in `values`. */
    readonly valueName: string
    /** The heading of the overlay. */
    readonly title: SpecText
    /** The name and placeholder of its search field. */
    readonly searchLabel: SpecText
    /** What it says when no option fits. */
    readonly emptyBody: SpecText
}

/** The words of a confirmation, and the values sent once it is confirmed. */
export interface ConfirmChoice {
    /** The question. */
    readonly title: SpecText
    /** What confirming does. */
    readonly body: SpecText
    /** The words of the confirming control. */
    readonly confirmLabel: SpecText
    /** The words of the cancelling control. */
    readonly cancelLabel: SpecText
    /** The values the action receives. */
    readonly values: Readonly<Record<string, string>>
}

/** A row command that needs a pick or a confirmation before its action runs. */
export interface Choice {
    /** The id of the row command. */
    readonly command: string
    /** The command id the action receives. */
    readonly sends: string
    /** The pick, when the command chooses one of the options. */
    readonly pick?: PickChoice | undefined
    /** The confirmation, when the command confirms first. */
    readonly confirm?: ConfirmChoice | undefined
}

/** The choice a row command is declared with; null for a command that runs as it is. */
export const choiceOf = (choices: ReadonlyArray<Choice> | undefined, commandId: string): Choice | null =>
    choices?.find((entry) => entry.command === commandId) ?? null

/** The values a pick sends: the chosen id under the name the pick declares; none for a choice that is not a pick. */
export const pickedValues = (choice: Choice, id: string): Readonly<Record<string, string>> | null =>
    choice.pick === undefined ? null : { [choice.pick.valueName]: id }
