import type { BusinessLimit, IntentBusiness, IntentSource } from "@modules/domain/intent-contracts"
import type { SetupProposal } from "../agent-graph-contract-setup.schema"
import { valueHashOf } from "./conflict.policy"

/** The longest value of a fact the prompt of the setup carries, and the longest passage a source keeps. */
const FACT_VALUE_MAX = 300
const PASSAGE_MAX = 2000

/** What the setup needs of a fact of the Second Brain. */
export interface ContractSetupFact {
    /** The fact id. */
    readonly id: string
    /** What it is about, as people write it. */
    readonly subject: string
    /** The attribute, as people write it. */
    readonly attribute: string
    /** The value as written. */
    readonly value: string
}

/** One contract NIVO proposes, with the ids of the Brain facts that back it. */
export interface ProposedContract {
    /** The business half the owner is asked to approve. */
    readonly business: IntentBusiness
    /** The facts it cites, once each. */
    readonly factIds: ReadonlyArray<string>
}

/** One fact as a line of the prompt: its id, so the model can cite it, then what it says. */
export const factLineOf = (fact: ContractSetupFact): string =>
    `${fact.id} | ${fact.subject} | ${fact.attribute}: ${fact.value.slice(0, FACT_VALUE_MAX)}`

const sourceOf = (fact: ContractSetupFact): IntentSource => ({
    kind: "brain",
    factId: fact.id,
    passage: fact.value.slice(0, PASSAGE_MAX),
    valueHash: valueHashOf(fact.value),
})

const unique = (ids: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(ids)]

/**
 * The contracts to propose from what the model answered. The model picks the words; code decides what stands: an intent the graph does
 * not offer is dropped, and so is every limit and every task that cites no fact of the Second Brain, because a rule no fact states is
 * invented. A cited fact the Brain does not hold is not cited. Each intent is proposed once.
 */
export const contractsFromSetup = (
    proposal: SetupProposal,
    facts: ReadonlyArray<ContractSetupFact>,
    offered: ReadonlyArray<string>,
): ReadonlyArray<ProposedContract> => {
    const known = new Map(facts.map((fact) => [fact.id, fact]))
    const cited = (ids: ReadonlyArray<string>): ReadonlyArray<ContractSetupFact> =>
        unique(ids).flatMap((id) => known.get(id) ?? [])
    const seen = new Set<string>()
    return proposal.contracts.flatMap((entry) => {
        if (!offered.includes(entry.intent) || seen.has(entry.intent)) return []
        seen.add(entry.intent)
        const taskFacts = cited(entry.task_fact_ids)
        const limits = entry.limits.flatMap(
            (limit): ReadonlyArray<BusinessLimit & { readonly ids: ReadonlyArray<string> }> => {
                const backing = cited(limit.fact_ids)
                return backing.length === 0
                    ? []
                    : [
                          {
                              text: limit.text,
                              triggers: limit.triggers,
                              trusts: limit.trusts,
                              sources: backing.map((fact) => sourceOf(fact)),
                              ids: backing.map((fact) => fact.id),
                          },
                      ]
            },
        )
        const task = taskFacts.length === 0 ? "" : entry.task
        if (task === "" && limits.length === 0) return []
        return [
            {
                business: {
                    intent: entry.intent,
                    task,
                    limits: limits.map(({ text, triggers, trusts, sources }) => ({
                        text,
                        triggers,
                        trusts,
                        sources,
                    })),
                    sources: taskFacts.map((fact) => sourceOf(fact)),
                },
                factIds: unique([...taskFacts.map((fact) => fact.id), ...limits.flatMap((limit) => limit.ids)]),
            },
        ]
    })
}
