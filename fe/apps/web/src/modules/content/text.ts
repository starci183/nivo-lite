import type { Variant } from "./types"

/** Normalises one hashtag to "#word", or "" when nothing is left. */
export const cleanHashtag = (h: string): string => {
    const word = h
        .trim()
        .replace(/^#+/, "")
        .replace(/[\s#]+/g, "")
    return word === "" ? "" : `#${word}`
}

/** Normalises and de-duplicates hashtags. */
export const cleanHashtags = (list: ReadonlyArray<string>): Array<string> => [
    ...new Set(list.map(cleanHashtag).filter((tag) => tag !== "")),
]

/** The text of one channel exactly as it will be pasted: body, then the hashtags that are not already in it. */
export const copyReadyText = (v: Variant | undefined): string => {
    if (v === undefined) return ""
    const missing = v.hashtags.filter((tag) => !v.text.includes(tag))
    return missing.length > 0 ? `${v.text.trimEnd()}\n\n${missing.join(" ")}` : v.text
}

/** Cuts a text to a length, ending with "..." when it was cut. */
export const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n).trimEnd()}...` : s)

/** A string trimmed, or "" for anything that is not a string. */
export const trimmedText = (value: unknown): string => (typeof value === "string" ? value.trim() : "")
