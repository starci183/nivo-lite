import { parseJsonText } from "@modules/platform/primitives"

/** The value a JSON text holds; a text that is no JSON fails the test at the line that read it, naming the text. */
export const jsonTextOf = (text: string): unknown => {
    const read = parseJsonText(text)
    if (!read.ok) throw new Error(`the text is no JSON: ${text.slice(0, 80)}`, { cause: read.cause })
    return read.value
}
