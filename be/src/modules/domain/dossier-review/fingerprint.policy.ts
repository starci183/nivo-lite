import { createHash } from "node:crypto"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { FindingCandidate } from "./dossier-inputs.contracts"

const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 32)

/** The ids of the sources and of the facts a list of evidence cites. */
export interface CitedIds {
    /** The source ids, sorted and distinct. */
    sources: Array<string>
    /** The fact ids, sorted and distinct. */
    facts: Array<string>
}

const byText = (a: string, b: string): number => a.localeCompare(b)

/** The ids of the sources and facts a list of evidence cites, sorted and distinct. */
export const citedIds = (evidence: ReadonlyArray<FindingEvidence>): CitedIds => ({
    sources: [...new Set(evidence.flatMap((item) => (item.sourceId === null ? [] : [item.sourceId])))].sort(byText),
    facts: [...new Set(evidence.flatMap((item) => (item.factId === null ? [] : [item.factId])))].sort(byText),
})

/** The identity of a finding within its workspace: the rule, the dossier and the rule's subject; a model finding is its dossier, kind and the sorted ids it cites. */
export const fingerprintOf = (candidate: FindingCandidate): string => {
    if (candidate.origin === "ai") {
        const cited = citedIds(candidate.evidence)
        return hashOf(
            `ai|${candidate.dossierId ?? "-"}|${candidate.kind}|${[...cited.sources, ...cited.facts].sort(byText).join(",")}`,
        )
    }
    return hashOf(`${candidate.ruleKey}|${candidate.dossierId ?? "-"}|${candidate.subject}`)
}

/** What the evidence was, ignoring labels and roles: a dismissed finding re-detected with a different hash reopens. */
export const evidenceHashOf = (evidence: ReadonlyArray<FindingEvidence>): string =>
    hashOf(
        JSON.stringify(
            evidence
                .map((item) => [item.sourceId, item.passageId, item.factId, item.quote])
                .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)),
        ),
    )

/** The key of one (rule, dossier) pair a rule pass evaluated; only a rule finding whose pair was evaluated may be resolved by a re-check. */
export const coverageKey = (ruleKey: string, dossierId: string | null): string => `${ruleKey}|${dossierId ?? "-"}`
