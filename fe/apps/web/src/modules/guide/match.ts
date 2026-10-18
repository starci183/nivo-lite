import type { GuidePage } from "./sitemap"

/** Lower-case, accents removed (the Vietnamese d with stroke becomes d), punctuation to spaces. */
export const normalize = (value: string): string =>
    value
        .toLowerCase()
        .replaceAll(String.fromCodePoint(0x111), "d")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9@.]+/gu, " ")
        .trim()

/** The search phrases of a page, by page id. */
export type GuideKeywords = (pageId: string) => ReadonlyArray<string>

const scoreOf = (question: string, page: GuidePage, keywordsOf: GuideKeywords): number => {
    const whole = normalize(question)
    const padded = ` ${whole} `
    let score = 0
    for (const keyword of keywordsOf(page.id)) {
        const key = normalize(keyword)
        // A longer phrase is stronger evidence.
        if (key && padded.includes(` ${key} `)) score += key.split(" ").length + 1
        // The question is exactly this name ("SePay", "Zalo OA").
        if (key && whole === key) score += 2
    }
    return score
}

/**
 * The one page a question clearly asks about, or null when it is unclear (then the model answers). Clear means a score of at least 3
 * (a two-word phrase, or two single words) and at least 1.5 times the runner-up, so one general word does not pick one provider.
 */
export const matchPage = (
    question: string,
    pages: ReadonlyArray<GuidePage>,
    keywordsOf: GuideKeywords,
): GuidePage | null => {
    const ranked = pages
        .map((page) => ({ page, score: scoreOf(question, page, keywordsOf) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
    const [best, next] = ranked
    if (!best || best.score < 3) return null
    if (next && best.score < next.score * 1.5) return null
    return best.page
}
