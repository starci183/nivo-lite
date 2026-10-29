import type { FactAudience, FactRecord, InstallationScope } from "./brain-facts.contracts"
import { factSlugOf } from "./fact-key.policy"

/** Whether a fact is visible to an agent with this audience, module and instance (the view of the one shared brain). */
export const visibleTo = (
    fact: Pick<FactRecord, "scope" | "modules" | "installationId">,
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
export const inForce = (fact: Pick<FactRecord, "validFrom" | "validTo">, at: number): boolean =>
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
