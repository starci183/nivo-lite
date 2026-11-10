import { isBindings } from "../node/memory"
import { LOOP_BODY_ROUTE, LOOP_STEP, OUTCOME_PARAM, OUTCOME_STEP } from "../node/memory.contracts"
import type { GraphSpec, GraphSpecNode } from "./graph-spec.types"

/** The dominators of each node: the nodes every path from the start to it passes through, itself included. */
export type DominatorMap = ReadonlyMap<string, ReadonlySet<string>>

/** The keys a node leads to: its `next` and every route (the `failed` route among them). */
export const edgesOfNode = (node: GraphSpecNode | undefined): ReadonlyArray<string> =>
    node === undefined ? [] : [...(node.next === undefined ? [] : [node.next]), ...Object.values(node.routes ?? {})]

/** The keys reachable from the first node, in the order they are met. */
const reachableKeys = (first: string, byKey: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<string> => {
    const reached: Array<string> = []
    const pending = [first]
    const seen = new Set<string>()
    for (let key = pending.shift(); key !== undefined; key = pending.shift()) {
        const node = byKey.get(key)
        if (node === undefined || seen.has(key)) continue
        seen.add(key)
        reached.push(key)
        pending.push(...edgesOfNode(node))
    }
    return reached
}

/** The reached nodes that lead straight to each reached node. */
const predecessorsOf = (
    reached: ReadonlyArray<string>,
    byKey: ReadonlyMap<string, GraphSpecNode>,
): ReadonlyMap<string, ReadonlyArray<string>> => {
    const predecessors = new Map<string, Array<string>>(reached.map((key) => [key, []]))
    for (const key of reached)
        for (const target of edgesOfNode(byKey.get(key))) predecessors.get(target)?.push(key)
    return predecessors
}

/**
 * The dominators of every node reachable from the first: the nodes every path from the start to it passes through (itself included).
 * Iterative data-flow over the spec's edges (`next`, every route, the `failed` route among them); the graphs are small.
 */
export const dominatorsOf = (spec: GraphSpec): DominatorMap => {
    const first = spec.nodes[0]
    if (first === undefined) return new Map()
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const reached = reachableKeys(first.key, byKey)
    const predecessors = predecessorsOf(reached, byKey)
    const all = new Set(reached)
    const dominators = new Map<string, Set<string>>(
        reached.map((key) => [key, key === first.key ? new Set([key]) : new Set(all)]),
    )
    for (let changed = true; changed; ) {
        changed = false
        for (const key of reached) {
            if (key === first.key) continue
            const sets = (predecessors.get(key) ?? []).map((from) => dominators.get(from) ?? all)
            const meet = new Set([...all].filter((candidate) => sets.every((set) => set.has(candidate))))
            meet.add(key)
            const before = dominators.get(key) ?? all
            if (meet.size !== before.size || [...meet].some((candidate) => !before.has(candidate))) {
                dominators.set(key, meet)
                changed = true
            }
        }
    }
    return dominators
}

/**
 * The body of every for-each node: the nodes reachable from its `body` route without passing through the loop node again. A node in
 * two bodies (nested loops) belongs to both; `loopOfNode` names the innermost.
 */
export const loopBodiesOf = (spec: GraphSpec): ReadonlyMap<string, ReadonlySet<string>> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    return new Map(
        spec.nodes
            .filter((node) => node.step === LOOP_STEP && node.routes?.[LOOP_BODY_ROUTE] !== undefined)
            .map((loop) => {
                const body = new Set<string>()
                const pending = [loop.routes?.[LOOP_BODY_ROUTE] ?? ""]
                for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
                    const node = byKey.get(key)
                    if (node === undefined || key === loop.key || body.has(key)) continue
                    body.add(key)
                    pending.push(...edgesOfNode(node))
                }
                return [loop.key, body]
            }),
    )
}

/** The innermost for-each node whose body holds each node, by node key; a node outside every body is absent. */
export const loopOfNode = (spec: GraphSpec): ReadonlyMap<string, string> => {
    const bodies = [...loopBodiesOf(spec)].sort(([, left], [, right]) => right.size - left.size)
    const loops = new Map<string, string>()
    for (const [loop, body] of bodies) for (const key of body) loops.set(key, loop)
    return loops
}

/**
 * The outcome that types `out.*` in a node: that of the nearest outcome step dominating it (strictly), or null when none does. The
 * nearest is the dominator that every other dominating outcome step also dominates.
 */
export const outcomeOfNode = (
    spec: GraphSpec,
    nodeKey: string,
    dominators: DominatorMap = dominatorsOf(spec),
): string | null => {
    const above = spec.nodes.filter(
        (candidate) =>
            candidate.step === OUTCOME_STEP &&
            candidate.key !== nodeKey &&
            dominators.get(nodeKey)?.has(candidate.key) === true,
    )
    const nearest = above.find((candidate) =>
        above.every((other) => dominators.get(candidate.key)?.has(other.key) === true),
    )
    const params = nearest?.params
    const outcome: unknown = isBindings(params) ? params[OUTCOME_PARAM] : undefined
    return typeof outcome === "string" ? outcome : null
}

/** Whether `to` is reachable from `from` by one or more edges. */
export const reaches = (spec: GraphSpec, from: string, to: string): boolean => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const pending = [...edgesOfNode(byKey.get(from))]
    const seen = new Set<string>()
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        if (key === to) return true
        if (seen.has(key)) continue
        seen.add(key)
        pending.push(...edgesOfNode(byKey.get(key)))
    }
    return false
}
