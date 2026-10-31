import { foldText } from "./document-state.policy"
import { LEAVE_ATTRIBUTES, ROLE_ATTRIBUTES, SOLE_ROLES, TITLE_ATTRIBUTES } from "./pack-vocabulary.policy"
import type { FindingCandidate, ReviewContext, ReviewFact, RoleKey } from "./dossier-inputs.contracts"
import {
    candidateOf,
    dateOfFact,
    datesOf,
    displayDate,
    dossierOfFact,
    dossierOfSources,
    factEvidence,
    factsOfContext,
    hasAnyWord,
    isAttribute,
    remedyActionOf,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** One person holding a role in one fact, with the span the fact or its document gives. */
export interface Holding {
    /** The name as written. */
    readonly name: string
    /** The folded name: the identity of the person. */
    readonly key: string
    /** How the documents call the role. */
    readonly roleLabel: string
    /** The fact. */
    readonly fact: ReviewFact
    /** From when, YYYY-MM-DD, or null when unknown. */
    readonly from: string | null
    /** Until when, or null when open. */
    readonly to: string | null
}

const words = (slugs: ReadonlyArray<string>): ReadonlyArray<string> => slugs.map((slug) => slug.replaceAll("-", " "))

/** The holdings of a role in a list of facts: a fact whose attribute names the role (the value is the person), or a person's title fact whose value names the role. */
export const holdingsOf = (
    facts: ReadonlyArray<ReviewFact>,
    role: RoleKey,
    dates: ReadonlyMap<string, string | null>,
): ReadonlyArray<Holding> =>
    facts.flatMap((fact) => {
        const named = isAttribute(fact, ROLE_ATTRIBUTES[role])
        const titled =
            isAttribute(fact, TITLE_ATTRIBUTES) && hasAnyWord(foldText(fact.value), words(ROLE_ATTRIBUTES[role]))
        if (!named && !titled) return []
        const name = named ? fact.value : fact.subject
        const documentDate = fact.sourceIds.map((id) => dates.get(id) ?? null).find((date) => date !== null) ?? null
        return [
            {
                name,
                key: foldText(name),
                roleLabel: named ? fact.attributeLabel : fact.value,
                fact,
                from: fact.validFrom ?? documentDate,
                to: fact.validTo,
            },
        ]
    })

/** The people who hold a role today: open or not yet ended, each once, the latest start first. */
export const currentHolders = (holdings: ReadonlyArray<Holding>, today: string): ReadonlyArray<Holding> => {
    const byPerson = new Map<string, Holding>()
    const ordered = [...holdings].sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""))
    for (const holding of ordered) {
        if ((holding.to === null || holding.to >= today) && !byPerson.has(holding.key))
            byPerson.set(holding.key, holding)
    }
    return [...byPerson.values()]
}

const overlaps = (a: Holding, b: Holding): boolean =>
    (a.from ?? "0000") <= (b.to ?? "9999") && (b.from ?? "0000") <= (a.to ?? "9999")

const holdersFindings = (context: ReviewContext, role: RoleKey): ReadonlyArray<FindingCandidate> => {
    const holdings = holdingsOf(factsOfContext(context), role, datesOf(context))
    const involved = holdings.filter((a) => holdings.some((b) => a.key !== b.key && overlaps(a, b)))
    const people = [...new Set(involved.map((holding) => holding.key))].sort((a, b) => a.localeCompare(b))
    if (people.length < 2) return []
    const latestStart = (key: string): string =>
        involved
            .filter((holding) => holding.key === key)
            .map((holding) => holding.from ?? "")
            .reduce((max, from) => (from > max ? from : max), "")
    const ordered = [...involved].sort(
        (a, b) => latestStart(a.key).localeCompare(latestStart(b.key)) || a.key.localeCompare(b.key),
    )
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const related = ordered.flatMap((holding) => {
        const owner = dossierOfFact(holding.fact, owners)
        return owner === undefined ? [] : [owner]
    })
    return ordered.slice(0, 1).flatMap((head) => {
        const filed = dossierOfFact(head.fact, owners)
        if (filed === undefined) return []
        return [
            candidateOf(filed, {
                ruleKey: "roles.holders",
                subject: `${role}:${people.join(",")}`,
                kind: "contradiction",
                severity: "high",
                code: "roles_holders",
                params: {
                    role: head.roleLabel,
                    holders: [...new Set(ordered.map((holding) => holding.name))].join(", "),
                },
                evidence: ordered.map((holding, index) =>
                    factEvidence(holding.fact, index === 0 ? "claim" : "counter", titles),
                ),
                remedyAction: remedyActionOf(filed, "decide"),
                related,
            }),
        ]
    })
}

const leftFindings = (context: ReviewContext, role: RoleKey): ReadonlyArray<FindingCandidate> => {
    const facts = factsOfContext(context)
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const holdings = holdingsOf(facts, role, datesOf(context))
    return facts
        .filter((fact) => isAttribute(fact, LEAVE_ATTRIBUTES))
        .flatMap((leave) => {
            const leftOn = dateOfFact(leave)
            if (leftOn === null || leftOn >= context.today) return []
            const person = foldText(leave.subject)
            return holdings
                .filter((holding) => holding.key === person && holding.to === null)
                .flatMap((holding) => {
                    const filed = dossierOfFact(holding.fact, owners)
                    if (filed === undefined) return []
                    return [
                        candidateOf(filed, {
                            ruleKey: "roles.left",
                            subject: `${role}:${person}:${holding.fact.id}`,
                            kind: "outdated",
                            severity: "high",
                            code: "roles_left",
                            params: { person: leave.subject, role: holding.roleLabel, leftOn: displayDate(leftOn) },
                            evidence: [
                                factEvidence(holding.fact, "claim", titles),
                                factEvidence(leave, "event", titles),
                            ],
                            remedyAction: remedyActionOf(filed, "decide"),
                        }),
                    ]
                })
        })
}

/** roles.holders: two people holding a one-person role at overlapping times; roles.left: a person who left still named in a role without an end. */
export const roleRules: RuleFamily = (context) => [
    ...SOLE_ROLES.flatMap((role) => holdersFindings(context, role)),
    ...SOLE_ROLES.flatMap((role) => leftFindings(context, role)),
]
