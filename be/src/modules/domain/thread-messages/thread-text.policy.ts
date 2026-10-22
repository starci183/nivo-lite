import { MAX_STEP_TITLE } from "./thread-messages.contracts"

/** The first line of a text. */
const firstLineOf = (text: string): string => {
    const end = text.indexOf("\n")
    return end === -1 ? text : text.slice(0, end)
}

/** The title of the chain step a message makes: the explicit title, else the first line of the text, cut to fit with three dots. */
export const stepTitleOf = (explicit: string | null, body: string): string => {
    const source = (explicit ?? firstLineOf(body)).trim()
    return source.length > MAX_STEP_TITLE ? `${source.slice(0, MAX_STEP_TITLE - 3).trimEnd()}...` : source
}
