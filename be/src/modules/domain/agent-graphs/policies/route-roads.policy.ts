import { CALL_WORKFLOW_STEP, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { TEMPLATE_IF_STEP } from "@modules/domain/installed-plugins"
import { TEMPLATE_HAND_BACK_STEP } from "@modules/domain/agent-threads/thread-hand-back.policy"

/*
 * THE ROADS OF A STEP'S ROUTES (pure). Rule (R75, engine words): a route's road runs from its target through the steps that do no work
 * of their own (the engine's data condition `core.when`, every branch; a hand-back, its `next`) to the first step that does: a node, an
 * outcome, a loop, a wait, or a workflow call. Each road ends OPEN (any step but a call, or no step: the run ends) or at a CALL (the
 * module and workflow the call names). Nothing here knows a module, a workflow or a route name.
 */

/** Where one road of a route ends. */
export type RoadEnd =
    | { readonly kind: "open" }
    | { readonly kind: "call"; readonly module: string; readonly workflow: string }

/** One declared route of a step with the ends of every road it leads to. */
export interface RouteRoads {
    readonly route: string
    readonly ends: ReadonlyArray<RoadEnd>
}

const OPEN: RoadEnd = { kind: "open" }

/** The call a call step names, or an open end when its params name no module and workflow (the call effect refuses such a call). */
const callEndOf = (node: GraphSpecNode): RoadEnd => {
    const { agent, workflow } = node.params ?? {}
    return typeof agent === "string" && agent !== "" && typeof workflow === "string" && workflow !== ""
        ? { kind: "call", module: agent, workflow }
        : OPEN
}

/** The ends of every road from `key` (a step key, or none: the run ends), each step walked once; a key no step holds is an open end. */
const endsFrom = (byKey: ReadonlyMap<string, GraphSpecNode>, key: string | undefined, seen: Set<string>): ReadonlyArray<RoadEnd> => {
    if (key === undefined) return [OPEN]
    // A step reached again adds no new end (two branches meeting, or a cycle).
    if (seen.has(key)) return []
    const node = byKey.get(key)
    if (node === undefined) return [OPEN]
    seen.add(key)
    if (node.step === CALL_WORKFLOW_STEP) return [callEndOf(node)]
    if (node.step === TEMPLATE_IF_STEP) {
        const branches = Object.values(node.routes ?? {})
        // A condition with a branch that names no step ends the run on that branch: an open end.
        const open = branches.length < 2 ? [OPEN] : []
        return [...open, ...branches.flatMap((next) => endsFrom(byKey, next, seen))]
    }
    if (node.step === TEMPLATE_HAND_BACK_STEP) return endsFrom(byKey, node.next, seen)
    return [OPEN]
}

/** Every declared route of the step `nodeKey` (its `routes` entries, in order) with the ends of its roads; none for a step that does not route. */
export const routeRoadsOf = (nodes: ReadonlyArray<GraphSpecNode>, nodeKey: string): ReadonlyArray<RouteRoads> => {
    const byKey = new Map(nodes.map((node) => [node.key, node] as const))
    const step = byKey.get(nodeKey)
    if (step === undefined) return []
    return Object.entries(step.routes ?? {}).map(([route, target]) => ({
        route,
        ends: endsFrom(byKey, target, new Set([nodeKey])),
    }))
}
