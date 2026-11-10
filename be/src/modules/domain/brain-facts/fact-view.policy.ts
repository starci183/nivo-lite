import type { FactAudience, FactReach, FactRecord, FactWindow, InstallationScope } from "./brain-facts.contracts"
import { factSlugOf } from "./fact-key.policy"

/** Whether a fact is visible to an agent with this audience, module and instance (the view of the one shared brain). */
export const visibleTo = (
    fact: FactReach,
    audience: FactAudience,
    module: string,
    installationId: InstallationScope,
): boolean => {
    if (fact.installationId !== null && fact.installationId !== installationId) return false
    if (fact.scope === "public") return true
    if (fact.scope === "internal") return audience === "internal"
    return audience === "internal" && fact.modules.includes(module)
}

/** Whether a fact is in force at this instant (its validity window). */
export const inForce = (fact: FactWindow, at: number): boolean =>
    (fact.validFrom === null || Date.parse(fact.validFrom) <= at) &&
    (fact.validTo === null || Date.parse(fact.validTo) > at)

/** One line of a fact for a prompt or a list: subject, attribute and value. */
export const factLine = (fact: FactRecord): string => `${fact.subjectLabel} - ${fact.attributeLabel}: ${fact.value}`

/**
 * The facts that match a question, best first: every word of the question (accents ignored) counts once when it appears in the
 * subject, the attribute or the value; the subject counts double. A workspace keeps a few hundred facts, so this runs in memory.
 */
export const searchFacts = (facts: ReadonlyArray<FactRecord>, query: string, limit: number): Array<FactRecord> => {
    const words = [
        ...new Set(
            factSlugOf(query)
                .split("-")
                .filter((word) => word.length > 1),
        ),
    ]
    return facts
        .map((fact) => {
            const subject = `-${fact.subjectKey}-`
            const rest = `-${fact.attribute}-${factSlugOf(fact.value)}-`
            const score = words.reduce(
                (sum, word) => sum + (subject.includes(`-${word}-`) ? 2 : 0) + (rest.includes(`-${word}-`) ? 1 : 0),
                0,
            )
            return { fact, score }
        })
        .filter((scored) => scored.score > 0)
        .sort((a, b) => b.score - a.score || b.fact.trust - a.fact.trust)
        .slice(0, limit)
        .map((scored) => scored.fact)
}

/** The weight of the vector half of a fact's hybrid score; the word half weighs the rest (passage search uses the same 0.7 / 0.3). */
const VECTOR_WEIGHT = 0.7

/**
 * A fact is a vector-only hit under this cosine distance to the question. Evidence (dev, profile `embed`, 2026-11-12, read-only): 253
 * pairs of unrelated passages of one flower shop sit at p25 0.47, median 0.54; passages on the same topic at 0.15-0.25. A question and
 * the one-line fact that answers it are expected well under 0.5; most unrelated lines of the same shop sit above it. Looser than this
 * and every question returns the whole shop; a word match is a hit whatever the distance.
 */
export const FACT_VECTOR_HIT = 0.5

/** A fact a vector search ranked, with its cosine distance to the question. */
export interface RankedFact {
    /** The fact. */
    readonly fact: FactRecord
    /** The cosine distance, 0 = same direction. */
    readonly distance: number
}

/**
 * The facts of a view that match a question, best first, by words AND meaning, like the passage search: 0.7 x cosine similarity (only
 * for facts the vector search found, which compares one embedding identity only) + 0.3 x the word score (the share of the question's
 * words found, the subject counting double). A fact is a hit with a word match or a distance under `FACT_VECTOR_HIT`. Only facts of the
 * view are ever answered: a vector hit outside `facts` (another lens, not in force) is ignored. With no vector hits this is the word
 * search.
 */
export const hybridFacts = (
    facts: ReadonlyArray<FactRecord>,
    near: ReadonlyArray<RankedFact>,
    query: string,
    limit: number,
): Array<FactRecord> => {
    const words = [
        ...new Set(
            factSlugOf(query)
                .split("-")
                .filter((word) => word.length > 1),
        ),
    ]
    const away = new Map(near.map((hit) => [hit.fact.id, hit.distance]))
    return facts
        .map((fact) => {
            const subject = `-${fact.subjectKey}-`
            const rest = `-${fact.attribute}-${factSlugOf(fact.value)}-`
            const matched = words.reduce(
                (sum, word) => sum + (subject.includes(`-${word}-`) ? 2 : 0) + (rest.includes(`-${word}-`) ? 1 : 0),
                0,
            )
            const distance = away.get(fact.id)
            const text = words.length === 0 ? 0 : Math.min(1, matched / (2 * words.length))
            const vector = distance === undefined ? 0 : Math.max(0, 1 - distance)
            const hit = matched > 0 || (distance !== undefined && distance < FACT_VECTOR_HIT)
            return { fact, hit, score: VECTOR_WEIGHT * vector + (1 - VECTOR_WEIGHT) * text }
        })
        .filter((scored) => scored.hit)
        .sort((a, b) => b.score - a.score || b.fact.trust - a.fact.trust)
        .slice(0, limit)
        .map((scored) => scored.fact)
}
