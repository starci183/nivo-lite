import type { FindingCandidate } from "./dossier-inputs.contracts"
import { candidateOf, dossierOfFact, dossierOfSources, factEvidence, factsOfContext, titlesOf } from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** facts.conflict: two document facts of the pass the Second Brain marked as disagreeing; the owner's decision in Brain > Review ends it. */
export const factConflictRules: RuleFamily = (context) => {
    const facts = factsOfContext(context)
    const byId = new Map(facts.map((fact) => [fact.id, fact]))
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const seen = new Set<string>()
    return facts.flatMap((fact): ReadonlyArray<FindingCandidate> => {
        const other = fact.conflictWith === null ? undefined : byId.get(fact.conflictWith)
        const filed = dossierOfFact(fact, owners)
        if (other === undefined || filed === undefined) return []
        const pair = [fact.id, other.id].sort((a, b) => a.localeCompare(b)).join(",")
        if (seen.has(pair)) return []
        seen.add(pair)
        const otherOwner = dossierOfFact(other, owners)
        return [
            candidateOf(filed, {
                ruleKey: "facts.conflict",
                subject: pair,
                kind: "contradiction",
                severity: "medium",
                code: "facts_conflict",
                params: {
                    subject: fact.subject,
                    attribute: fact.attributeLabel,
                    first: fact.value,
                    second: other.value,
                },
                evidence: [factEvidence(fact, "claim", titles), factEvidence(other, "counter", titles)],
                remedyAction: "decide",
                related: otherOwner === undefined ? [] : [otherOwner],
            }),
        ]
    })
}
