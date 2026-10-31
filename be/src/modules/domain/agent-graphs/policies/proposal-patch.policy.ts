import type { Condition, GraphBranch, GraphDocument, GraphNode } from "../agent-graphs.contracts"
import { intervalOf, topOf } from "./interval.policy"

/** What a learned proposal moves: the signal, the branch it is about and the amounts of its evidence. */
export interface LearnedPatch {
    /** What the decisions taught: trust (raise the boundary), reject (lower it) or timeout (set a backup). */
    readonly signal: "trust" | "reject" | "timeout"
    /** The branch it is about. */
    readonly branchKey: string
    /** The amounts of the evidence decisions. */
    readonly amounts: ReadonlyArray<number>
}

/** Boundaries move in whole millions, as an owner says them. */
const STEP = 1_000_000

/** The fact the boundary of a branch is read on: the first fact its condition names. */
const amountFactOf = (branch: GraphBranch): string | null => {
    if (branch.when === "else") return null
    const found = (term: Condition): string | null => {
        if ("fact" in term) return term.fact
        const members = "all" in term ? term.all : term.any
        return members.map(found).find((fact) => fact !== null) ?? null
    }
    return found(branch.when)
}

/** The same condition with every number equal to `from` replaced by `to`. */
const moved = (term: Condition, from: number, to: number): Condition => {
    if ("all" in term) return { all: term.all.map((member) => moved(member, from, to)) }
    if ("any" in term) return { any: term.any.map((member) => moved(member, from, to)) }
    return "value" in term && term.value === from && term.op !== "in" ? { ...term, value: to } : term
}

const swap = (node: GraphNode, replace: (branches: ReadonlyArray<GraphBranch>) => ReadonlyArray<GraphBranch>): GraphNode =>
    node.decide === undefined ? node : { ...node, decide: { ...node.decide, branches: replace(node.decide.branches) } }

/** The auto branch right below the asked one: the branch that runs alone and ends where the asked one begins. */
const autoBelow = (branches: ReadonlyArray<GraphBranch>, asked: GraphBranch, fact: string): GraphBranch | undefined => {
    const lower = asked.when === "else" ? null : intervalOf(asked.when, fact)
    return branches.find((branch) => {
        const interval = branch.then === "auto" && branch.when !== "else" ? intervalOf(branch.when, fact) : null
        return interval !== null && lower !== null && topOf(interval) === lower.lo
    })
}

/** The line between the branch that runs alone and the asked one right above it. */
export interface Boundary {
    /** The decide node. */
    readonly node: GraphNode
    /** The branch that runs alone, below the line. */
    readonly auto: GraphBranch
    /** The branch that asks, above the line. */
    readonly asked: GraphBranch
    /** The amount where the auto branch ends. */
    readonly from: number
}

/** The line between the auto branch and the asked branch of that key, or null when the graph has no such pair. */
export const boundaryOf = (document: GraphDocument, askedKey: string): Boundary | null => {
    const node = document.nodes.find((entry) => entry.decide?.branches.some((branch) => branch.key === askedKey))
    const asked = node?.decide?.branches.find((branch) => branch.key === askedKey)
    const fact = asked === undefined ? null : amountFactOf(asked)
    const auto = asked === undefined || fact === null ? undefined : autoBelow(node?.decide?.branches ?? [], asked, fact)
    const interval = auto === undefined || auto.when === "else" || fact === null ? null : intervalOf(auto.when, fact)
    const from = interval === null ? null : topOf(interval)
    return node === undefined || auto === undefined || asked === undefined || from === null ? null : { node, auto, asked, from }
}

/** Moves the boundary between the auto branch and the asked one to a number the evidence picks, in both. */
const boundaryMoved = (
    document: GraphDocument,
    branchKey: string,
    pick: (old: number, amounts: ReadonlyArray<number>) => number,
    amounts: ReadonlyArray<number>,
): GraphDocument | null => {
    const line = boundaryOf(document, branchKey)
    if (line === null) return null
    const to = pick(line.from, amounts)
    if (to === line.from) return null
    const replace = (branches: ReadonlyArray<GraphBranch>): ReadonlyArray<GraphBranch> =>
        branches.map((branch) =>
            (branch.key === line.auto.key || branch.key === line.asked.key) && branch.when !== "else"
                ? { ...branch, when: moved(branch.when, line.from, to), selfCorrected: true }
                : branch,
        )
    return { ...document, nodes: document.nodes.map((entry) => (entry.key === line.node.key ? swap(entry, replace) : entry)) }
}

const raised = (old: number, amounts: ReadonlyArray<number>): number =>
    Math.max(old, Math.ceil(Math.max(...amounts, old) / STEP) * STEP)

const lowered = (old: number, amounts: ReadonlyArray<number>): number => {
    const floor = Math.floor(Math.min(...amounts, old) / STEP) * STEP
    return floor < old ? floor : old
}

/** A backup for an asked branch whose request ran out of time: the owners of the workspace. */
const withBackup = (document: GraphDocument, branchKey: string): GraphDocument | null => {
    const node = document.nodes.find((entry) => entry.decide?.branches.some((branch) => branch.key === branchKey))
    const asked = node?.decide?.branches.find((branch) => branch.key === branchKey)
    if (node === undefined || asked?.approver == null || asked.approver.onTimeout.kind === "backup") return null
    const approver = { ...asked.approver, onTimeout: { kind: "backup" as const, group: { roles: ["owner" as const], rooms: [], members: [] } } }
    const replace = (branches: ReadonlyArray<GraphBranch>): ReadonlyArray<GraphBranch> =>
        branches.map((branch) => (branch.key === branchKey ? { ...branch, approver, selfCorrected: true } : branch))
    return { ...document, nodes: document.nodes.map((entry) => (entry.key === node.key ? swap(entry, replace) : entry)) }
}

/**
 * The graph a confirmed learned proposal makes, or null when it no longer applies (the branch is gone, the boundary already stands
 * there, a backup is already named). A raise or a lowering moves the boundary between the auto branch and the asked one to a whole
 * million of the evidence; a timeout names the owners as the backup. Nothing is published here: the owner confirms and the publish
 * checks it like any other change.
 */
export const applyLearned = (document: GraphDocument, patch: LearnedPatch): GraphDocument | null => {
    if (patch.signal === "timeout") return withBackup(document, patch.branchKey)
    if (patch.amounts.length === 0) return null
    return boundaryMoved(document, patch.branchKey, patch.signal === "trust" ? raised : lowered, patch.amounts)
}
