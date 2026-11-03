import { canonicalJson } from "./canonical"
import type { UpdateUnit } from "./format.types"
import type { GraphBranch, GraphDocument, GraphNode } from "./graph.types"

/** The three graphs of an update: the version installed (with the buyer's values), what the buyer has now, and the version offered. */
export interface MergeInput {
    /** The version the buyer installed, as the buyer's values made it. */
    readonly base: GraphDocument
    /** The graph that decides now, with the buyer's edits. */
    readonly current: GraphDocument
    /** The version offered, with the buyer's values. */
    readonly next: GraphDocument
}

/** What a branch does, without where it came from. */
const branchSignature = (branch: GraphBranch): string =>
    canonicalJson({ when: branch.when, then: branch.then, next: branch.next, approver: branch.approver })

/** What a node is apart from its branches and where it came from. */
const nodeSignature = (node: GraphNode): string =>
    canonicalJson({
        ...node,
        sources: [],
        decide: node.decide === undefined ? null : { intent: node.decide.intent, facts: node.decide.facts },
    })

const nodeOf = (graph: GraphDocument, key: string): GraphNode | undefined =>
    graph.nodes.find((node) => node.key === key)

const branchOf = (node: GraphNode | undefined, key: string): GraphBranch | undefined =>
    node?.decide?.branches.find((branch) => branch.key === key)

const nodeId = (key: string): string => `node:${key}`
const branchId = (nodeKey: string, key: string): string => `branch:${nodeKey}:${key}`

const kindOfChange = (base: string, current: string): "upgrade" | "conflict" =>
    base === current ? "upgrade" : "conflict"

const branchUnits = (
    base: GraphNode | undefined,
    current: GraphNode | undefined,
    next: GraphNode,
): ReadonlyArray<UpdateUnit> => {
    const offered = (next.decide?.branches ?? []).flatMap((branch): ReadonlyArray<UpdateUnit> => {
        const before = branchOf(base, branch.key)
        const now = branchOf(current, branch.key)
        const unit = (change: UpdateUnit["change"]): ReadonlyArray<UpdateUnit> => [
            { id: branchId(next.key, branch.key), nodeKey: next.key, branchKey: branch.key, change },
        ]
        if (before === undefined)
            return now === undefined
                ? unit("added")
                : branchSignature(now) === branchSignature(branch)
                  ? []
                  : unit("conflict")
        if (branchSignature(before) === branchSignature(branch)) return []
        if (now === undefined) return unit("conflict")
        return branchSignature(now) === branchSignature(branch)
            ? []
            : unit(kindOfChange(branchSignature(before), branchSignature(now)))
    })
    const nextKeys = new Set((next.decide?.branches ?? []).map((branch) => branch.key))
    const dropped = (base?.decide?.branches ?? [])
        .filter((branch) => !nextKeys.has(branch.key) && branchOf(current, branch.key) !== undefined)
        .map((branch): UpdateUnit => ({
            id: branchId(next.key, branch.key),
            nodeKey: next.key,
            branchKey: branch.key,
            change: "removed",
        }))
    return [...offered, ...dropped]
}

/**
 * What the version offered changes in a graph the buyer may have edited, one unit per node or branch. A unit the buyer never touched
 * is an `upgrade`; one the buyer changed too is a `conflict` and stays the buyer's until they take it; what the creator added is
 * `added` and what the creator dropped is `removed`. Nothing is applied here: a unit moves only when the buyer accepts it.
 */
export const updateUnits = (input: MergeInput): ReadonlyArray<UpdateUnit> => {
    const fromNext = input.next.nodes.flatMap((node): ReadonlyArray<UpdateUnit> => {
        const base = nodeOf(input.base, node.key)
        const current = nodeOf(input.current, node.key)
        if (base === undefined) {
            return current === undefined
                ? [{ id: nodeId(node.key), nodeKey: node.key, branchKey: null, change: "added" }]
                : []
        }
        const own: ReadonlyArray<UpdateUnit> =
            nodeSignature(base) === nodeSignature(node) || current === undefined
                ? []
                : nodeSignature(current) === nodeSignature(node)
                  ? []
                  : [
                        {
                            id: nodeId(node.key),
                            nodeKey: node.key,
                            branchKey: null,
                            change: kindOfChange(nodeSignature(base), nodeSignature(current)),
                        },
                    ]
        return [...own, ...branchUnits(base, current, node)]
    })
    const nextKeys = new Set(input.next.nodes.map((node) => node.key))
    const removed = input.base.nodes
        .filter((node) => !nextKeys.has(node.key) && nodeOf(input.current, node.key) !== undefined)
        .map((node): UpdateUnit => ({ id: nodeId(node.key), nodeKey: node.key, branchKey: null, change: "removed" }))
    return [...fromNext, ...removed]
}

const withBranch = (node: GraphNode, branch: GraphBranch, at: number): GraphNode => {
    if (node.decide === undefined) return node
    const branches = node.decide.branches
    if (branches.some((entry) => entry.key === branch.key)) {
        return {
            ...node,
            decide: { ...node.decide, branches: branches.map((entry) => (entry.key === branch.key ? branch : entry)) },
        }
    }
    const limit = branches.at(-1)?.when === "else" ? branches.length - 1 : branches.length
    const index = Math.min(at, limit)
    return {
        ...node,
        decide: { ...node.decide, branches: [...branches.slice(0, index), branch, ...branches.slice(index)] },
    }
}

const apply = (graph: GraphDocument, next: GraphDocument, unit: UpdateUnit): GraphDocument => {
    const offered = nodeOf(next, unit.nodeKey)
    const own = nodeOf(graph, unit.nodeKey)
    if (unit.branchKey === null) {
        if (unit.change === "removed")
            return { ...graph, nodes: graph.nodes.filter((node) => node.key !== unit.nodeKey) }
        if (offered === undefined) return graph
        if (own === undefined) return { ...graph, nodes: [...graph.nodes, offered] }
        const kept =
            own.decide === undefined || offered.decide === undefined
                ? offered
                : { ...offered, decide: { ...offered.decide, branches: own.decide.branches } }
        return { ...graph, nodes: graph.nodes.map((node) => (node.key === unit.nodeKey ? kept : node)) }
    }
    if (own === undefined) return graph
    if (unit.change === "removed") {
        const decide = own.decide
        if (decide === undefined) return graph
        const trimmed = {
            ...own,
            decide: { ...decide, branches: decide.branches.filter((branch) => branch.key !== unit.branchKey) },
        }
        return { ...graph, nodes: graph.nodes.map((node) => (node.key === unit.nodeKey ? trimmed : node)) }
    }
    const offeredBranches = offered?.decide?.branches ?? []
    const wanted = offeredBranches.find((branch) => branch.key === unit.branchKey)
    if (wanted === undefined) return graph
    const at = offeredBranches.indexOf(wanted)
    return {
        ...graph,
        nodes: graph.nodes.map((node) => (node.key === unit.nodeKey ? withBranch(node, wanted, at) : node)),
    }
}

/** The buyer's graph with only the accepted units taken from the version offered; every other node and branch stays as the buyer has it. */
export const applyUnits = (
    current: GraphDocument,
    next: GraphDocument,
    units: ReadonlyArray<UpdateUnit>,
    accepted: ReadonlyArray<string>,
): GraphDocument =>
    units.filter((unit) => accepted.includes(unit.id)).reduce((graph, unit) => apply(graph, next, unit), current)
