const DIGIT = /\d/u

/**
 * A text without diacritics or case, with every run of other characters as one space, so a name written with its accents and the same
 * name typed without them fold alike. The stroked d (U+0111) has no decomposition, so it is folded by its code point.
 */
export const foldText = (text: string): string =>
    text
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/\u0111/giu, "d")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, " ")
        .trim()

const compact = (text: string): string => foldText(text).replaceAll(" ", "")

/** Whether the folded text names the folded name as whole words; a name shorter than two letters is never named. */
export const mentionsName = (text: string, name: string | null | undefined): boolean => {
    const wanted = foldText(name ?? "")
    return wanted.length >= 2 && ` ${foldText(text)} `.includes(` ${wanted} `)
}

const mentionsFrom = (text: string, want: string, from: number): boolean => {
    const at = text.indexOf(want, from)
    if (at < 0) return false
    return !DIGIT.test(text[at + want.length] ?? "") || mentionsFrom(text, want, at + 1)
}

/** Whether the text names this code once separators and case are ignored; a longer number that only starts with the code does not count. */
export const mentionsCode = (text: string, code: string): boolean => {
    const want = compact(code)
    return want !== "" && mentionsFrom(compact(text), want, 0)
}
