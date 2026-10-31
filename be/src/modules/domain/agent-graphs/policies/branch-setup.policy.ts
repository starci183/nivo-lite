import type { Condition, GraphBranch, GraphDocument, GraphNode, GraphSource } from "../agent-graphs.contracts"
import { boundaryOf } from "./proposal-patch.policy"

/** What the owner confirmed in the setup chat about one action. */
export interface BranchSetup {
    /** The authority action whose bands the owner spoke of. */
    readonly action: string
    /** The amount where the lower band ends and the higher one begins. */
    readonly boundaryVnd: number
    /** The band the exact boundary amount belongs to. */
    readonly belongsTo: "lower" | "higher"
    /** The seat asked above the line. */
    readonly approverMemberId: string
    /** The source of the branch: the words of the owner. */
    readonly source: GraphSource
}

/** The same condition with every number equal to `from` set to `to` and compared with `op`. */
const reset = (term: Condition, from: number, to: number, op: "lt" | "lte" | "gt" | "gte"): Condition => {
    if ("all" in term) return { all: term.all.map((member) => reset(member, from, to, op)) }
    if ("any" in term) return { any: term.any.map((member) => reset(member, from, to, op)) }
    return "value" in term && term.value === from && term.op !== "in" ? { ...term, op, value: to } : term
}

const DEFAULT_WAIT_MINUTES = 240

const withSource = (branch: GraphBranch, source: GraphSource): GraphBranch => ({
    ...branch,
    sources: [...branch.sources.filter((entry) => entry.kind !== source.kind), source],
})

/** The decide node of an action, or undefined. */
const nodeOf = (document: GraphDocument, action: string): GraphNode | undefined =>
    document.nodes.find((node) => node.decide?.intent === action)

/**
 * The graph with what the owner said written into the action: the line between the branch that runs alone and the first branch that asks
 * moves to the amount said, the exact amount goes to the band the owner named, and the person named is the one asked above the line,
 * keeping the policy and the wait the branch had (a new approver waits a day, and what happens after is the next thing the chat asks).
 * Both branches cite the words of the owner. Null when the action has no such pair of branches.
 */
export const applyBranchSetup = (document: GraphDocument, setup: BranchSetup): GraphDocument | null => {
    const node = nodeOf(document, setup.action)
    const askedKey = node?.decide?.branches.find((branch) => branch.then === "ask")?.key
    const line = askedKey === undefined ? null : boundaryOf(document, askedKey)
    if (line === null || node?.decide === undefined) return null
    const lower = setup.belongsTo === "lower"
    const replace = (branches: ReadonlyArray<GraphBranch>): ReadonlyArray<GraphBranch> =>
        branches.map((branch) => {
            if (branch.when === "else") return branch
            if (branch.key === line.auto.key)
                return withSource(
                    { ...branch, when: reset(branch.when, line.from, setup.boundaryVnd, lower ? "lte" : "lt") },
                    setup.source,
                )
            if (branch.key !== line.asked.key) return branch
            const approver = branch.approver ?? {
                group: { roles: [], rooms: [], members: [] },
                policy: "any" as const,
                timeoutMinutes: DEFAULT_WAIT_MINUTES,
                onTimeout: { kind: "unset" as const },
            }
            return withSource(
                {
                    ...branch,
                    when: reset(branch.when, line.from, setup.boundaryVnd, lower ? "gt" : "gte"),
                    approver: { ...approver, group: { roles: [], rooms: [], members: [setup.approverMemberId] } },
                },
                setup.source,
            )
        })
    const decide = { ...node.decide, branches: replace(node.decide.branches) }
    return {
        ...document,
        nodes: document.nodes.map((entry) => (entry.key === node.key ? { ...entry, decide } : entry)),
    }
}
