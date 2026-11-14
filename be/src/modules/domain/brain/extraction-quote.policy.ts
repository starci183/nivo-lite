import { foldedText, numbersOf } from "@modules/domain/brain-facts"

/** A folded text with a space on each side, so a containment test matches whole words only ("10" is not inside "100"). */
export const bounded = (folded: string): string => ` ${folded} `

/**
 * Whether a text holds a value: the folded value is in the folded text as whole words, or the value writes numbers and every one of
 * them is a number of the text, however written ("350.000 d" = "350,000 VND" = "350k"; "8:00-20:00" = "8:00 den 20:00";
 * "2026-02-20" = "20/02/2026"). Words the model added around a number ("d", "VND", "mot don") do not count against it.
 */
export const quoteHoldsValue = (quote: string, value: string): boolean => {
    if (bounded(foldedText(quote)).includes(bounded(foldedText(value)))) return true
    const wanted = numbersOf(value)
    if (wanted.length === 0) return false
    const left = [...numbersOf(quote)]
    return wanted.every((number) => {
        const at = left.indexOf(number)
        if (at < 0) return false
        left.splice(at, 1)
        return true
    })
}

/** The longest quote the code cuts. */
const QUOTE_MAX = 200

/** The lines of a passage as a quote is cut from them: a line of a list or a row, or a sentence of prose. */
const linesOfPassage = (passage: string): ReadonlyArray<string> =>
    passage
        .split(/\n|(?<=[.!?;])\s+/u)
        .map((line) => line.trim())
        .filter((line) => line !== "")

/** How many words of the labels a line names (folded, whole words): what tells two rows that hold the same value apart. */
const labelWordsIn = (line: string, labels: ReadonlySet<string>): number => {
    const words = new Set(foldedText(line).split(" "))
    return [...labels].filter((word) => words.has(word)).length
}

/**
 * The words of a passage a truth rests on, bound by the code to the line it was read from (D-N-14): among the lines that hold the
 * value (a line is a sentence of prose or a row), the ones that write the value itself before the ones that only share its numbers
 * (a value written out in one line beats a line that only shares its number), then the one that names most words of the
 * truth's subject and attribute (among rows of one table with the same value, the row that names the truth's case),
 * the first on a tie; at most 200 characters. The head of the passage when no single line holds the value.
 */
export const quoteOf = (passage: string, value: string, labels = ""): string => {
    const holding = linesOfPassage(passage).filter((line) => quoteHoldsValue(line, value))
    if (holding.length === 0) return passage.trim().slice(0, QUOTE_MAX)
    const written = holding.filter((line) => bounded(foldedText(line)).includes(bounded(foldedText(value))))
    const pool = written.length > 0 ? written : holding
    const words = new Set(
        foldedText(labels)
            .split(" ")
            .filter((word) => word.length > 1 || /\d/.test(word)),
    )
    const best = pool.reduce(
        (chosen, line) => (labelWordsIn(line, words) > labelWordsIn(chosen, words) ? line : chosen),
        pool[0] ?? "",
    )
    return best.slice(0, QUOTE_MAX)
}
