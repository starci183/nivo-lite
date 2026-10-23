import { CLAIM_FIGURE, CLAIM_OFFER, CLAIM_PROMISES } from "./content.templates"
import type { ContentChannel } from "./types"

/** One finding of the pre-approval checks. */
export type ClaimWarning =
    | { readonly kind: "promise"; readonly phrase: string }
    | { readonly kind: "figure"; readonly figure: string }
    | { readonly kind: "length"; readonly length: number; readonly max: number }

/** Whether a line of knowledge talks about prices, promotions or events. */
export const isOfferLine = (line: string): boolean => CLAIM_OFFER.test(line)

/** The key that makes two warnings the same finding. */
export const warningKey = (w: ClaimWarning): string => {
    if (w.kind === "promise") return `p:${w.phrase}`
    if (w.kind === "figure") return `f:${w.figure}`
    return `l:${w.length}`
}

/**
 * Plain checks a post must pass before an owner sees it (the editor runs them live, the writer runs them with the business knowledge).
 * `knowledge` is the business facts the post must stay inside; leave it out to check only for outcome promises.
 */
export const claimWarnings = (text: string, knowledge?: string): Array<ClaimWarning> => {
    const promises = CLAIM_PROMISES.flatMap((re) => {
        const match = re.exec(text)
        return match === null ? [] : [{ kind: "promise" as const, phrase: match[0] }]
    })
    if (knowledge === undefined) return promises
    const facts = knowledge.replace(/\s+/g, "").toLowerCase()
    const figures = [...text.matchAll(CLAIM_FIGURE)].flatMap((match) => {
        const raw = match[1] ?? ""
        const figure = raw.replace(/\s+/g, "").toLowerCase()
        return facts.includes(figure) ? [] : [{ kind: "figure" as const, figure: raw.trim() }]
    })
    return [...promises, ...figures]
}

/** A finding together with the channel whose text it is about. */
export interface ChannelWarning {
    readonly channel: ContentChannel
    readonly warning: ClaimWarning
}

/** The catalog key and values that explain a finding. */
export const warningMessage = (
    w: ClaimWarning,
): { readonly key: string; readonly values: Record<string, string | number> } => {
    if (w.kind === "promise") return { key: "claimPromise", values: { phrase: w.phrase } }
    if (w.kind === "figure") return { key: "claimFigure", values: { figure: w.figure } }
    return { key: "claimLength", values: { length: w.length, max: w.max } }
}
