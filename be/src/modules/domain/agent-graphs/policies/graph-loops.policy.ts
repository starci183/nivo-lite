import {
    LOOP_EVERY_BOUNDS,
    LOOP_EXHAUSTED_ROUTE,
    LOOP_UNTIL_CAP,
    LOOP_UNTIL_WAIT_CAP,
    STOP_STEP,
    loopBodiesOf,
    type GraphSpec,
    type GraphSpecNode,
} from "@nivo-lite/agent-sdk/graph"
import { LOOP_BODY_ROUTE } from "@nivo-lite/agent-sdk/node"
import { storedExprProblems } from "@modules/domain/graph-nodes"
import { TEMPLATE_IF_STEP, TEMPLATE_UNTIL_STEP, TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"

/*
 * The engine's own checks of the loops and the cycles of a graph, as the ENGINE stores and runs it (`nivo/agent-graph@1`, a @2 graph
 * read by `graphOfSpecV2`): run on every save of a stored or UI-edited graph (`flow.policy.ts`) and again by the thread compiler, so a
 * raw document that never passed the SDK's `templateGraphProblems` is judged the same way. A cycle is legal ONLY through a loop: the way
 * from a body node back to its own loop node (the end of an item or of a round). Pure.
 */

/** The most rounds a `loop({ until })` may run: the global cap its `max` may lower, never raise (the SDK's `LOOP_UNTIL_CAP`). */
export const UNTIL_ROUNDS_MAX = LOOP_UNTIL_CAP

/** The most rounds of a `loop({ until })` whose body holds a `wait` (ruling R9: each round is parked, holds no slot and is bounded by the wait's timeout; the SDK's `LOOP_UNTIL_WAIT_CAP`). */
export const UNTIL_WAIT_ROUNDS_MAX = LOOP_UNTIL_WAIT_CAP

/** The route of an until loop to the branch taken when `max` rounds ran without the condition holding. */
export const UNTIL_EXHAUSTED_ROUTE = LOOP_EXHAUSTED_ROUTE

/** The milliseconds of one unit of `every`, and the most of each unit (the SDK's `LOOP_EVERY_BOUNDS`). */
const EVERY_UNITS: Readonly<Record<string, { readonly ms: number; readonly most: number }>> = {
    minutes: { ms: 60_000, most: LOOP_EVERY_BOUNDS.minutes },
    hours: { ms: 60 * 60_000, most: LOOP_EVERY_BOUNDS.hours },
    days: { ms: 24 * 60 * 60_000, most: LOOP_EVERY_BOUNDS.days },
}

/** Why a graph's loops or cycles cannot run. */
export type GraphLoopProblemCode =
    | "GRAPH_CYCLE"
    | "GRAPH_LOOP_MAX"
    | "GRAPH_LOOP_BODY_MISSING"
    | "GRAPH_LOOP_EXHAUSTED_MISSING"
    | "GRAPH_LOOP_CONDITION"
    | "GRAPH_LOOP_EVERY"
    | "GRAPH_LOOP_NESTED"
    | "GRAPH_LOOP_SHARED"

/** One problem and where it is: a node key, `<node>.until…` inside a condition, or the target of an edge. */
export interface GraphLoopProblem {
    /** The reason. */
    readonly code: GraphLoopProblemCode
    /** Where it is. */
    readonly at: string
}

/** What an until loop stops on: the data (an expression the engine compares) or the meaning (a body node's route). */
export type UntilCondition =
    | {
          /** By data: the expression, as stored (refs not resolved). */
          readonly kind: "data"
          readonly expr: unknown
      }
    | {
          /** By meaning: the body node whose route decides, and the route that ends the loop (any other continues). */
          readonly kind: "meaning"
          readonly node: string
          readonly stop: string
      }

/** How an until loop is set, read from its params. */
export interface UntilSettings {
    /** What it stops on. */
    readonly until: UntilCondition
    /** The most rounds, 1 to `UNTIL_ROUNDS_MAX`. */
    readonly max: number
    /** The wait between two rounds in milliseconds, or null for none. */
    readonly everyMs: number | null
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether a node is an until loop. */
export const isUntilNode = (node: Pick<GraphSpecNode, "step">): boolean => node.step === TEMPLATE_UNTIL_STEP

/**
 * The rounds cap of the params, or null when it is no whole number from 1 to `cap`. A run reads it up to the higher ceiling (a loop whose
 * body waits); which ceiling a loop may declare is the save check's (`untilNodeProblems`, structural: does its body hold a `wait`).
 */
const maxOf = (value: unknown, cap: number = UNTIL_WAIT_ROUNDS_MAX): number | null =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= cap ? value : null

/**
 * The wait of `every` in milliseconds (`{ minutes | hours | days: n }`, exactly one unit, a whole number from 1 to the unit's bound),
 * null when absent, or undefined when it is unreadable or out of bounds.
 */
const everyOf = (value: unknown): number | null | undefined => {
    if (value === undefined || value === null) return null
    if (!isRecord(value)) return undefined
    const entries = Object.entries(value)
    const [only] = entries
    if (entries.length !== 1 || only === undefined) return undefined
    const [name, amount] = only
    const unit = EVERY_UNITS[name]
    if (unit === undefined || typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > unit.most)
        return undefined
    return amount * unit.ms
}

/** The condition of the params: the meaning form `{ route, stop }`, else an expression (judged by `storedExprProblems`). */
const conditionOf = (value: unknown): UntilCondition | null => {
    if (value === undefined || value === null) return null
    if (isRecord(value) && "route" in value) {
        const { route, stop } = value
        return typeof route === "string" && route !== "" && typeof stop === "string" && stop !== ""
            ? { kind: "meaning", node: route, stop }
            : null
    }
    return { kind: "data", expr: value }
}

/** The settings of an until loop's params, or null when any of them is unreadable (the save check names which). */
export const untilSettingsOf = (params: unknown): UntilSettings | null => {
    const given = isRecord(params) ? params : {}
    const until = conditionOf(given.until)
    const max = maxOf(given.max)
    const everyMs = everyOf(given.every)
    if (until === null || max === null || everyMs === undefined) return null
    if (until.kind === "data" && storedExprProblems(until.expr).length > 0) return null
    return { until, max, everyMs }
}

/** Every edge of a node: its `next`, then its routes. */
const edgesOfNode = (node: GraphSpecNode): ReadonlyArray<string> => [
    ...(node.next === undefined ? [] : [node.next]),
    ...Object.values(node.routes ?? {}),
]

/** The members of each until loop's body, by the loop node's key: what its `body` route reaches without passing through it again. */
export const untilBodiesOf = (spec: GraphSpec): ReadonlyMap<string, ReadonlySet<string>> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    return new Map(
        spec.nodes.filter((item) => isUntilNode(item)).map((loop): [string, ReadonlySet<string>] => {
            const body = new Set<string>()
            const pending = [loop.routes?.[LOOP_BODY_ROUTE] ?? ""]
            for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
                const node = byKey.get(key)
                if (node === undefined || key === loop.key || body.has(key) || node.step === STOP_STEP) continue
                body.add(key)
                pending.push(...edgesOfNode(node))
            }
            return [loop.key, body]
        }),
    )
}

/** The bodies of every loop of a graph (the list loops' and the until loops'), by the loop node's key. */
const allBodiesOf = (spec: GraphSpec): ReadonlyMap<string, ReadonlySet<string>> => new Map([...loopBodiesOf(spec), ...untilBodiesOf(spec)])

/**
 * The nodes that lie on a cycle of the graph's edges once each legal back edge is taken out: the way from a node of a loop's body to
 * that loop node (the end of an item or a round). Any other way back is a cycle the engine refuses (`GRAPH_CYCLE`), one problem per node
 * on it.
 */
const cycleProblems = (spec: GraphSpec, bodies: ReadonlyMap<string, ReadonlySet<string>>): ReadonlyArray<GraphLoopProblem> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const forward = (node: GraphSpecNode): ReadonlyArray<string> =>
        edgesOfNode(node).filter((target) => bodies.get(target)?.has(node.key) !== true)
    const reachesItself = (start: GraphSpecNode): boolean => {
        const seen = new Set<string>()
        const pending = [...forward(start)]
        for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
            if (key === start.key) return true
            const node = byKey.get(key)
            if (node === undefined || seen.has(key)) continue
            seen.add(key)
            pending.push(...forward(node))
        }
        return false
    }
    return spec.nodes.filter((item) => reachesItself(item)).map((node): GraphLoopProblem => ({ code: "GRAPH_CYCLE", at: node.key }))
}

/** Whether a target names a node of the graph. */
const known = (byKey: ReadonlyMap<string, GraphSpecNode>, target: unknown): boolean => typeof target === "string" && byKey.has(target)

/** The problems of one until loop's own settings and routes. */
const untilNodeProblems = (
    loop: GraphSpecNode,
    byKey: ReadonlyMap<string, GraphSpecNode>,
    body: ReadonlySet<string>,
): ReadonlyArray<GraphLoopProblem> => {
    const params = isRecord(loop.params) ? loop.params : {}
    const at = (code: GraphLoopProblemCode, where = loop.key): GraphLoopProblem => ({ code, at: where })
    const bodyTarget = loop.routes?.[LOOP_BODY_ROUTE]
    const exhausted = loop.routes?.[UNTIL_EXHAUSTED_ROUTE]
    const condition = conditionOf(params.until)
    const conditionProblems = ((): ReadonlyArray<GraphLoopProblem> => {
        if (condition === null) return [at("GRAPH_LOOP_CONDITION", `${loop.key}.until`)]
        if (condition.kind === "meaning")
            return body.has(condition.node) ? [] : [at("GRAPH_LOOP_CONDITION", `${loop.key}.until.route`)]
        return storedExprProblems(condition.expr).map((one) =>
            at("GRAPH_LOOP_CONDITION", one.at === "" ? `${loop.key}.until` : `${loop.key}.until.${one.at}`),
        )
    })()
    return [
        ...(maxOf(params.max, roundsCapOf(byKey, body)) === null ? [at("GRAPH_LOOP_MAX")] : []),
        ...(known(byKey, bodyTarget) && byKey.get(bodyTarget ?? "")?.step !== STOP_STEP ? [] : [at("GRAPH_LOOP_BODY_MISSING")]),
        ...(known(byKey, exhausted) && !body.has(exhausted ?? "") ? [] : [at("GRAPH_LOOP_EXHAUSTED_MISSING")]),
        ...(everyOf(params.every) === undefined ? [at("GRAPH_LOOP_EVERY")] : []),
        ...conditionProblems,
    ]
}

/** The rounds ceiling of an until loop: 30 when its body holds a `wait` step (R9), else 10. */
const roundsCapOf = (byKey: ReadonlyMap<string, GraphSpecNode>, body: ReadonlySet<string>): number =>
    [...body].some((key) => byKey.get(key)?.step === TEMPLATE_WAIT_STEP) ? UNTIL_WAIT_ROUNDS_MAX : UNTIL_ROUNDS_MAX

/**
 * The problems of the until loops of a graph: per loop, `max` outside 1 to `UNTIL_ROUNDS_MAX` (`GRAPH_LOOP_MAX`), no body
 * (`GRAPH_LOOP_BODY_MISSING`), no `exhausted` branch or one inside the body (`GRAPH_LOOP_EXHAUSTED_MISSING`), an unreadable `every`
 * (`GRAPH_LOOP_EVERY`), an unreadable condition or a meaning node outside the body (`GRAPH_LOOP_CONDITION`); a loop inside another
 * loop's body or a loop inside an until body (`GRAPH_LOOP_NESTED`: a thread holds one frame); a node of an until body that a node
 * outside the loop also leads to (`GRAPH_LOOP_SHARED`).
 */
const untilProblems = (spec: GraphSpec, bodies: ReadonlyMap<string, ReadonlySet<string>>): ReadonlyArray<GraphLoopProblem> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const untils = untilBodiesOf(spec)
    const own = [...untils].flatMap(([key, body]) => {
        const loop = byKey.get(key)
        return loop === undefined ? [] : untilNodeProblems(loop, byKey, body)
    })
    const loops = new Set(bodies.keys())
    const nested = spec.nodes.flatMap((node): ReadonlyArray<GraphLoopProblem> => {
        const insideUntil = [...untils.values()].some((body) => body.has(node.key))
        const untilInside = isUntilNode(node) && [...bodies.values()].some((body) => body.has(node.key))
        return (insideUntil && loops.has(node.key)) || untilInside ? [{ code: "GRAPH_LOOP_NESTED", at: node.key }] : []
    })
    const shared = new Set<string>()
    for (const node of spec.nodes) {
        for (const [route, target] of [
            ...Object.entries(node.routes ?? {}),
            ...(node.next === undefined ? [] : [["", node.next] satisfies [string, string]]),
        ]) {
            const into = [...untils].find(([, body]) => body.has(target))
            if (into === undefined || into[1].has(node.key)) continue
            if (into[0] === node.key && route === LOOP_BODY_ROUTE) continue
            shared.add(target)
        }
    }
    return [...own, ...nested, ...[...shared].map((at): GraphLoopProblem => ({ code: "GRAPH_LOOP_SHARED", at }))]
}

/**
 * Every problem the engine refuses a graph's loops, cycles and conditions for: a cycle not through a loop (`GRAPH_CYCLE`), the until
 * loops' own problems, and an `if` condition the evaluator cannot decide. Empty for a graph without any. The one check of a save
 * (`flow.policy.ts`) and of the thread compiler.
 */
export const graphLoopProblemsOf = (spec: GraphSpec): ReadonlyArray<GraphLoopProblem> => {
    const bodies = allBodiesOf(spec)
    return [...cycleProblems(spec, bodies), ...untilProblems(spec, bodies), ...conditionProblems(spec)]
}

/**
 * The problems of the data conditions of the engine's `if` steps (`ifNode`, and `callWorkflows.when`, which compiles to one), read by
 * the same check as an until loop's condition (`storedExprProblems`: its shape as the evaluator reads it, then the SDK's `exprProblems`),
 * so a stored or UI-edited graph cannot carry a condition the engine cannot decide (`GRAPH_LOOP_CONDITION` at `<node>.when…`).
 */
const conditionProblems = (spec: GraphSpec): ReadonlyArray<GraphLoopProblem> =>
    spec.nodes
        .filter((node) => node.step === TEMPLATE_IF_STEP)
        .flatMap((node) => {
            const when: unknown = isRecord(node.params) ? node.params.when : undefined
            return storedExprProblems(when).map(
                (one): GraphLoopProblem => ({ code: "GRAPH_LOOP_CONDITION", at: one.at === "" ? `${node.key}.when` : `${node.key}.when.${one.at}` }),
            )
        })
