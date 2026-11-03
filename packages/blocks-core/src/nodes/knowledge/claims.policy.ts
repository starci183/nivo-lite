import type { NodeLocale } from "../node-schema.types"
import type { ClaimRule } from "./answer.types"

/** Where a sentence ends: after a full stop, a mark or a line break. */
const SENTENCE_END = /(?<=[.!?\n])\s+/u

/** The text lower case, without accents or doubled blanks, so a phrase matches however it is typed. */
export const plainOf = (text: string): string =>
    text.toLowerCase().normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll("đ", "d").replaceAll(/\s+/gu, " ").trim()

/** The reply cut by the claims the turn did not back. */
export interface ClaimsGuarded {
    /** The sentences that make no unbacked claim, in order; empty when every one made one. */
    readonly kept: ReadonlyArray<string>
    /** The ids of the claims found without their effect, each once. */
    readonly removed: ReadonlyArray<string>
}

/** The rules whose phrase the sentence makes, when their effect was not recorded in the turn. */
const unbackedIn = (
    sentence: string,
    rules: ReadonlyArray<ClaimRule>,
    recorded: ReadonlySet<string>,
    locale: NodeLocale,
): ReadonlyArray<string> => {
    const plain = plainOf(sentence)
    return rules
        .filter((rule) => !recorded.has(rule.requires))
        .filter((rule) => rule.phrases[locale].some((phrase) => plain.includes(plainOf(phrase))))
        .map((rule) => rule.id)
}

/** Takes out of the reply every sentence that claims an action the turn did not do. */
export const guardClaims = (
    reply: string,
    rules: ReadonlyArray<ClaimRule>,
    recordedEffects: ReadonlyArray<string>,
    locale: NodeLocale,
): ClaimsGuarded => {
    const recorded = new Set(recordedEffects)
    const sentences = reply.split(SENTENCE_END).map((sentence) => ({
        sentence,
        claims: unbackedIn(sentence, rules, recorded, locale),
    }))
    return {
        kept: sentences.filter(({ claims }) => claims.length === 0).map(({ sentence }) => sentence),
        removed: [...new Set(sentences.flatMap(({ claims }) => claims))],
    }
}
