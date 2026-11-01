import type { Condition, DecidePoint, GraphBranch, GraphDocument, GraphNode } from "../agent-graphs.contracts"
import { intervalOf, topOf } from "./interval.policy"
import type { Interval } from "./interval.policy"

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
    return "value" in term && term.value === from && term.op !== "in" ? { ...term, value: to } : term
}

/** The node with the branches of its decide point replaced. */
const swap = (
    node: GraphNode,
    decide: DecidePoint,
    replace: (branches: ReadonlyArray<GraphBranch>) => ReadonlyArray<GraphBranch>,
): GraphNode => ({ ...node, decide: { ...decide, branches: replace(decide.branches) } })

/** The node whose decide point holds the branch of that key, with the decide point and the branch. */
const holderOf = (
    document: GraphDocument,
    branchKey: string,
): { readonly node: GraphNode; readonly decide: DecidePoint; readonly branch: GraphBranch } | null => {
    for (const node of document.nodes) {
        const { decide } = node
        const branch = decide?.branches.find((entry) => entry.key === branchKey)
        if (decide !== undefined && branch !== undefined) return { node, decide, branch }
    }
    return null
}

/** The auto branch right below the line where the asked one begins: the branch that runs alone and ends there, with the amount it ends at. */
const autoBelow = (
    branches: ReadonlyArray<GraphBranch>,
    lower: Interval,
    fact: string,
): { readonly auto: GraphBranch; readonly from: number } | undefined =>
    branches.flatMap((branch) => {
        if (branch.then !== "auto" || branch.when === "else") return []
        const interval = intervalOf(branch.when, fact)
        const top = interval === null ? null : topOf(interval)
        return top !== null && top === lower.lo ? [{ auto: branch, from: top }] : []
    })[0]

/** The line between the branch that runs alone and the asked one right above it. */
export interface Boundary {
    /** The decide node. */
    readonly node: GraphNode
    /** Its decide point. */
    readonly decide: DecidePoint
    /** The branch that runs alone, below the line. */
    readonly auto: GraphBranch
    /** The branch that asks, above the line. */
    readonly asked: GraphBranch
    /** The amount where the auto branch ends. */
    readonly from: number
}

/** The line between the auto branch and the asked branch of that key, or null when the graph has no such pair. */
export const boundaryOf = (document: GraphDocument, askedKey: string): Boundary | null => {
    const held = holderOf(document, askedKey)
    if (held === null) return null
    const { node, decide, branch: asked } = held
    const fact = amountFactOf(asked)
    if (fact === null || asked.when === "else") return null
    const lower = intervalOf(asked.when, fact)
    const found = lower === null ? undefined : autoBelow(decide.branches, lower, fact)
    return found === undefined ? null : { node, decide, auto: found.auto, asked, from: found.from }
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
    return {
        ...document,
        nodes: document.nodes.map((entry) => (entry.key === line.node.key ? swap(entry, line.decide, replace) : entry)),
    }
}

const raised = (old: number, amounts: ReadonlyArray<number>): number =>
    Math.max(old, Math.ceil(Math.max(...amounts, old) / STEP) * STEP)

const lowered = (old: number, amounts: ReadonlyArray<number>): number => {
    const floor = Math.floor(Math.min(...amounts, old) / STEP) * STEP
    return floor < old ? floor : old
}

/** A backup for an asked branch whose request ran out of time: the owners of the workspace. */
const withBackup = (document: GraphDocument, branchKey: string): GraphDocument | null => {
    const held = holderOf(document, branchKey)
    if (held === null) return null
    const { node, decide, branch } = held
    const asking = branch.approver
    if (asking == null || asking.onTimeout.kind === "backup") return null
    const approver = {
        ...asking,
        onTimeout: { kind: "backup" as const, group: { roles: ["owner" as const], rooms: [], members: [] } },
    }
    const replace = (branches: ReadonlyArray<GraphBranch>): ReadonlyArray<GraphBranch> =>
        branches.map((branch) => (branch.key === branchKey ? { ...branch, approver, selfCorrected: true } : branch))
    return {
        ...document,
        nodes: document.nodes.map((entry) => (entry.key === node.key ? swap(entry, decide, replace) : entry)),
    }
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
