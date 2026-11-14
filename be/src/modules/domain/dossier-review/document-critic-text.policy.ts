import { foldText } from "./text-fold.policy"
import {
    CRITIC_CAPS,
    type CriticChoice,
    type CriticFact,
    type CriticPassage,
    type CriticQuote,
} from "./document-critic.contracts"

/** A quote of a fact of this document (its own quote, else its line), placed in its passage when its hash is known. */
export const factQuote = (
    fact: CriticFact,
    passages: ReadonlyArray<CriticPassage>,
    sourceId: string,
    title: string,
): CriticQuote => {
    const passage =
        passages.find((one) => one.hash === fact.chunkHash) ??
        passages.find((one) => fact.quote !== null && foldText(one.text).includes(foldText(fact.quote)))
    return {
        text: (fact.quote ?? `${fact.subjectLabel} - ${fact.attributeLabel}: ${fact.value}`).slice(0, CRITIC_CAPS.quoteMax),
        passageId: passage?.id ?? null,
        chunkHash: passage?.hash ?? fact.chunkHash,
        role: "this",
        factId: fact.id,
        sourceId,
        sourceTitle: title,
    }
}

/** The truths of this document read from a quoted place: born from its passage, their evidence quote inside the quoted words or holding them. */
export const truthsOfQuote = (quote: CriticQuote, facts: ReadonlyArray<CriticFact>): ReadonlyArray<CriticFact> => {
    const words = foldText(quote.text)
    return facts.filter((fact) => {
        if (fact.id === quote.factId) return true
        if (fact.quote === null || fact.chunkHash === null || fact.chunkHash !== quote.chunkHash) return false
        const stated = foldText(fact.quote)
        return stated.length > 0 && (words.includes(stated) || stated.includes(words))
    })
}

/**
 * A point with the truths it names (D-R-3): for each quote it takes from this document, the truths read from that line. `namesAll`
 * says every such quote gave at least one: the point then holds those truths and nothing else of their passages.
 */
export const namedTruths = <T extends { readonly quotes: ReadonlyArray<CriticQuote> }>(
    point: T,
    facts: ReadonlyArray<CriticFact>,
): T & { readonly names: ReadonlyArray<string>; readonly namesAll: boolean } => {
    const own = point.quotes.filter((quote) => quote.role === "this")
    const named = own.map((quote) => truthsOfQuote(quote, facts).map((fact) => fact.id))
    return {
        ...point,
        names: [...new Set(named.flat())].sort((a, b) => a.localeCompare(b)),
        namesAll: own.length > 0 && named.every((ids) => ids.length > 0),
    }
}

/** A button that names a value already written: pick that fact when there is one, else file the value. */
export const valueChoice = (id: "a" | "b", label: string, value: string, factId: string | null): CriticChoice => ({
    id,
    label,
    needsInput: false,
    inputHint: null,
    answer: { kind: factId === null ? "value" : "pick", factId, value },
})
