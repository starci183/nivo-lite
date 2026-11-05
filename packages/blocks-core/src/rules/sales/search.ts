import { wordOf } from "../../messages/catalog"

/** The comparable form of a text: without accents, case or extra spaces, so a name typed without accents finds the same name with them. */
export const foldText = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replaceAll(wordOf("letterD"), "d")
        .replaceAll(wordOf("letterDCapital"), "D")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()

/** Whether a search text is found in any of the values: accent-insensitive and case-insensitive substring; no search matches all. */
export const matchesQuery = (query: string | null, values: ReadonlyArray<string | null>): boolean => {
    const wanted = foldText(query ?? "")
    if (wanted === "") return true
    return values.some((value) => value !== null && foldText(value).includes(wanted))
}
