/** The longest normalized question that makes a dedupe key. */
const GAP_KEY_MAX = 160

/**
 * What makes a gap the same one however it is cased, accented, spaced or punctuated: the normalized question. The agent raises it once
 * per question, so a customer who asks again does not raise a second proposal.
 */
export const gapKeyOf = (question: string): string =>
    `gap:${question
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .slice(0, GAP_KEY_MAX)}`
