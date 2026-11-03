import type { HandoffInput } from "./handoff.types"

/** The text of a tag: the note, and the context as one line of JSON after it when there is one. */
export const tagTextOf = (input: HandoffInput): string =>
    input.context === null || Object.keys(input.context).length === 0
        ? input.text
        : `${input.text}\n${JSON.stringify(input.context)}`
