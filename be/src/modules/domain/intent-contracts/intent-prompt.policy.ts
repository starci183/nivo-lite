const KIND_MAX = 40

/** The words with the opening of any data mark defused (`<data`, `</data>`, spaced or in capitals), so they cannot close the block they sit in. */
const defused = (text: string): string => text.replaceAll(/<(?=\s{0,8}\/?\s{0,8}data)/giu, "< ")

/** One piece of data, wrapped and marked: whatever it says, it stays data. */
export const dataTagOf = (kind: string, text: string): string => {
    const name = kind.replaceAll(/[^a-z0-9_]/giu, "_").slice(0, KIND_MAX)
    return `<data kind="${name}">\n${defused(text.trim())}\n</data>`
}
