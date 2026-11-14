import { z } from "../../schema/zod-entry"
import { TRIGGER_SYSTEM_MEMBERS } from "../../graph/graph-refs"
import {
    MISSING,
    UNTYPED,
    branchesOf,
    fits,
    jsonSchemaOf,
    schemaAt,
    typeOfSchema,
    type Json,
} from "../../graph/graph-ref-schema"
import type {
    GraphSpecV2,
    GraphV2LoopOverStep,
    GraphV2LoopStep,
    GraphV2LoopUntilStep,
    GraphV2NodeStep,
    GraphV2HandBackStep,
    GraphV2Step,
    GraphV2WaitOn,
    GraphV2WaitStep,
    LoopEvery,
    StoredExpr,
    StoredRef,
} from "../../graph/graph-spec-v2.types"
import {
    LOOP_CONCURRENCY_CAP,
    LOOP_EVERY_BOUNDS,
    LOOP_ITEM_SELF_KEY,
    LOOP_OVER_CAP,
    LOOP_UNTIL_CAP,
    LOOP_UNTIL_WAIT_CAP,
    WAIT_ROUTE_MEMBER,
    WAIT_TIMEOUT_ROUTE,
    WAIT_TRIGGERS_MAX,
    isLoopOver,
    isLoopUntil,
    isUntilRoute,
} from "../../graph/graph-spec-v2"
import { exprProblems, exprRefsOf, type ExprValueKind } from "./expr-problems"
import { admitsNull, ifFacts, presentAt, readAt, routeFact, type RefFact } from "./ref-narrowing"
import { contractTypeFits, type ContractType, type SuppliedParam } from "../../graph/workflow-contract"
import { isParamRef, parseRef } from "../../node/memory"
import type { ParamBinding, ParamBindings } from "../../node/memory.contracts"
import { PROVIDER, type ProviderKey, type ToolId, type TriggerVerb } from "../../names"
import { isRecord } from "../../schema/is-record"
import type { AnyTemplateNode } from "./template-example"
import { askWritesProblems, duplicatesOf } from "./template-node"
import type { TemplateProblem } from "./template-problems"

/**
 * What only the engine knows of tools: whether its registry has a spec, which providers have an adapter for a tool, and which tools write.
 * No tool is special (`nivo-frame.rights`): there is no ask-only class.
 */
export interface TemplateToolLookup {
    /** Whether the engine's registry has a spec for the tool. */
    readonly known: (tool: ToolId) => boolean
    /** Whether the provider has an adapter for the tool. */
    readonly owns: (provider: ProviderKey, tool: ToolId) => boolean
    /**
     * True for a tool that WRITES (it mutates; not a read): the calls an `ask` step interrupts for approval (a read never asks), as the
     * engine's registry flags it. The save judges with it that a step on `ask` holds at most one write tool (`NODE_ASK_WRITES_MANY`);
     * absent: not judged.
     */
    readonly writes?: ((tool: ToolId) => boolean) | undefined
}

/** What a trigger verb supplies to a run: nothing known (no spec), the caller's mapping (`workflow.called`), or fixed members. */
export type TriggerSupply =
    | { readonly kind: "unknown" }
    | { readonly kind: "caller" }
    | { readonly kind: "fixed"; readonly params: ReadonlyArray<SuppliedParam> }

/** Who carries a verb's events: the engine's own road (no account), a provider's account (exactly one), or no spec at all. */
export type TriggerCarrier = "engine" | "provider" | "unknown"

/**
 * What only the engine knows of triggers: what each verb supplies PER PROVIDER (ruling B5: the website form supplies other members than
 * a channel message). `provider` absent asks for the verb's engine road (the trigger names no account); `unknown` for a verb with no
 * spec, or a provider that does not serve the verb. `carriedBy` says whether a verb is the engine's own or provider-backed (owner key
 * `triggerOneSource2026_11_12`: a provider-backed trigger binds exactly one account, an engine verb none); absent: not judged.
 */
export interface TemplateTriggerLookup {
    /** What the verb supplies to a run, for the provider named (or for the engine's own road). */
    readonly supplies: (verb: TriggerVerb, provider?: ProviderKey) => TriggerSupply
    /** Whether the verb is the engine's own or provider-backed; absent: not judged. */
    readonly carriedBy?: ((verb: TriggerVerb) => TriggerCarrier) | undefined
}

/** What a graph is judged against: its template nodes by id, and, when known, the agent's providers and the engine's lookups. */
export interface TemplateGraphContext {
    /** The template nodes the graph places, by node id. */
    readonly nodes: ReadonlyMap<string, AnyTemplateNode>
    /** The providers of the agent template the graph belongs to; absent: not judged. */
    readonly agentAccounts?: ReadonlyArray<ProviderKey> | undefined
    /** The engine's tool lookup; absent: tools are not judged. */
    readonly tools?: TemplateToolLookup | undefined
    /** The engine's trigger lookup; absent: triggers are not judged. */
    readonly triggers?: TemplateTriggerLookup | undefined
    /**
     * `strict`: a ref that may read nothing (a null or optional source member, a side step, a step that does not dominate) must fit its
     * site with what it then resolves to (its `default`, or the member left out / null in a list), else `GRAPH_REF_TYPE`. Absent or
     * `lenient`: only the JSON types are compared, null ignored. `defineTemplateGraph` judges every graph `strict`; a bare
     * `compileTemplateGraph` / `templateGraphProblems` call stays lenient unless it asks.
     */
    readonly nullability?: "strict" | "lenient" | undefined
}

type Problem = TemplateProblem

/**
 * The providers of the agent a graph is judged against, or null when none is given. `nivo` (NIVO's own tools) is ALWAYS the agent's:
 * an agent template need not list it (listing it stays legal), so a node or trigger naming it is never outside the agent.
 */
const agentProvidersOf = (context: TemplateGraphContext): ReadonlySet<string> | null =>
    context.agentAccounts === undefined ? null : new Set<string>([PROVIDER.nivo, ...context.agentAccounts])

/** The keys a step goes to. */
export const edgesOfStep = (step: GraphV2Step): ReadonlyArray<string> => {
    switch (step.kind) {
        case "node":
            return [...(step.next === undefined ? [] : [step.next]), ...Object.values(step.routes ?? {})]
        case "if":
            return [
                ...(step.routes.yes === undefined ? [] : [step.routes.yes]),
                ...(step.routes.no === undefined ? [] : [step.routes.no]),
            ]
        case "loop":
            return isLoopOver(step)
                ? [step.routes.body, ...(step.next === undefined ? [] : [step.next])]
                : untilEdges(step)
        case "call-workflow":
        case "outcome":
        case "hand-back":
            return step.next === undefined ? [] : [step.next]
        case "wait":
            return [...new Set(Object.values(step.routes))]
    }
}

/** The keys an `until` loop goes to: its body, `next`, `exhausted` (each only when written, for a document from untyped code). */
const untilEdges = (step: GraphV2LoopUntilStep): ReadonlyArray<string> =>
    [step.routes.body, step.next, step.routes.exhausted].filter(
        (key): key is string => typeof key === "string" && key !== "",
    )

/**
 * The keys a step goes to, but its own loop: a body step naming its loop is a `LOOP_BODY_LEAK` (the end of an item or a round is written
 * as no target), never also a `GRAPH_CYCLE`. Every other edge back is a cycle: the graph as written is acyclic.
 */
const forwardEdgesOf = (step: GraphV2Step): ReadonlyArray<string> =>
    edgesOfStep(step).filter((to) => step.loop === undefined || to !== step.loop)

/** The graph's steps by key, and the steps each one comes from. */
interface Shape {
    /** Every step by its key. */
    readonly byKey: ReadonlyMap<string, GraphV2Step>
    /** For each step key, the keys of the steps that go to it. */
    readonly preds: ReadonlyMap<string, ReadonlyArray<string>>
    /** Topological order from the start, or null when the steps go round. */
    readonly order: ReadonlyArray<string> | null
    /** The keys of the steps reached from the start. */
    readonly reached: ReadonlySet<string>
    /** The facts the road to a step proves (`factsOf`), about the value a ref of the step reads at `root`. */
    readonly factsAt: (key: string, root: string) => ReadonlyArray<RefFact>
}

/** The order of the steps (Kahn), or null for a cycle. */
const topologicalOrder = (byKey: ReadonlyMap<string, GraphV2Step>): ReadonlyArray<string> | null => {
    const indegree = new Map<string, number>([...byKey.keys()].map((key) => [key, 0]))
    for (const step of byKey.values())
        for (const to of forwardEdgesOf(step)) if (indegree.has(to)) indegree.set(to, (indegree.get(to) ?? 0) + 1)
    const ready = [...byKey.keys()].filter((key) => indegree.get(key) === 0)
    const order: Array<string> = []
    for (let key = ready.shift(); key !== undefined; key = ready.shift()) {
        order.push(key)
        const step = byKey.get(key)
        for (const to of step === undefined ? [] : forwardEdgesOf(step)) {
            const left = (indegree.get(to) ?? 0) - 1
            indegree.set(to, left)
            if (left === 0) ready.push(to)
        }
    }
    return order.length === byKey.size ? order : null
}

const shapeOf = (spec: GraphSpecV2): Shape => {
    const byKey = new Map<string, GraphV2Step>()
    for (const step of spec.nodes) if (!byKey.has(step.key)) byKey.set(step.key, step)
    const preds = new Map<string, Array<string>>()
    for (const step of byKey.values())
        for (const to of forwardEdgesOf(step)) preds.set(to, [...(preds.get(to) ?? []), step.key])
    const reached = new Set<string>()
    const pending = [spec.nodes[0].key]
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        const step = byKey.get(key)
        if (step !== undefined && !reached.has(key)) {
            reached.add(key)
            pending.push(...edgesOfStep(step))
        }
    }
    const order = topologicalOrder(byKey)
    let facts: ((key: string) => ReadonlyArray<RefFact>) | null = null
    const factsAt = (key: string, root: string): ReadonlyArray<RefFact> => {
        facts ??= order === null ? () => [] : factsOf(spec.nodes[0].key, byKey)
        return facts(key).filter((fact) => fact.root === root)
    }
    return { byKey, preds, order, reached, factsAt }
}

/** The steps reached from `start` by the forward edges, but those `cut` names. */
const reachedFrom = (
    start: string,
    byKey: ReadonlyMap<string, GraphV2Step>,
    cut: (from: string, to: string) => boolean,
): ReadonlySet<string> => {
    const reached = new Set<string>()
    const pending = [start]
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        const step = byKey.get(key)
        if (step === undefined || reached.has(key)) continue
        reached.add(key)
        pending.push(...forwardEdgesOf(step).filter((to) => !cut(key, to)))
    }
    return reached
}

/** The route names of a step grouped by the target they lead to, in the order the routes are written. */
const routeNamesByTarget = (routes: Readonly<Record<string, string>>): Map<string, Array<string>> => {
    const byTarget = new Map<string, Array<string>>()
    for (const [name, to] of Object.entries(routes)) byTarget.set(to, [...(byTarget.get(to) ?? []), name])
    return byTarget
}

/**
 * NARROWING: what the road to each step proves. A branch of a step is its edge to one target: an `if`'s `yes` (when `when` held) or `no`
 * (`ifFacts`; only when the two go to different steps), a routing node's route(s) to one target (`routeFact`: its `routeBy` member is
 * one of the names that lead there; only for a node with no `next`). A step is reached ONLY through a branch when cutting that edge leaves
 * it unreached from the start (every path to it takes the edge): the branch's facts hold at that step, and only there. A body step is cut
 * off from the steps after its loop (no edge leaves a body), so nothing proven in a body holds past it. Read from the stored @2 steps
 * (`routeBy`, `routes`, `when`), so a stored graph narrows as its builder does.
 */
const factsOf = (start: string, byKey: ReadonlyMap<string, GraphV2Step>): ((key: string) => ReadonlyArray<RefFact>) => {
    const all = reachedFrom(start, byKey, () => false)
    const branches: Array<{ readonly only: ReadonlySet<string>; readonly facts: ReadonlyArray<RefFact> }> = []
    const branch = (from: string, to: string | undefined, facts: ReadonlyArray<RefFact>): void => {
        if (to === undefined || facts.length === 0 || !all.has(from)) return
        const without = reachedFrom(start, byKey, (edgeFrom, edgeTo) => edgeFrom === from && edgeTo === to)
        branches.push({ only: new Set([...all].filter((key) => !without.has(key))), facts })
    }
    for (const step of byKey.values()) {
        if (step.kind === "if" && step.routes.yes !== step.routes.no) {
            branch(step.key, step.routes.yes, ifFacts(step.params.when, "yes"))
            branch(step.key, step.routes.no, ifFacts(step.params.when, "no"))
        }
        if (step.kind === "wait") {
            // A wait routes on what came (`output.trigger`): a step reached only along a key's route reads that key's event.
            for (const [to, names] of routeNamesByTarget(step.routes))
                branch(step.key, to, [routeFact(step.key, WAIT_ROUTE_MEMBER, names)])
        }
        if (
            step.kind === "node" &&
            step.routeBy !== undefined &&
            step.routes !== undefined &&
            step.next === undefined
        ) {
            for (const [to, names] of routeNamesByTarget(step.routes))
                branch(step.key, to, [routeFact(step.key, step.routeBy, names)])
        }
    }
    return (key) => branches.flatMap((one) => (one.only.has(key) ? one.facts : []))
}

/** The steps every path from the start to each step passes (itself included), over an acyclic graph. */
const dominatorsOf = (
    start: string,
    shape: Shape,
    order: ReadonlyArray<string>,
): ReadonlyMap<string, ReadonlySet<string>> => {
    const dominators = new Map<string, ReadonlySet<string>>()
    for (const key of order) {
        if (!shape.reached.has(key)) continue
        const from = (shape.preds.get(key) ?? []).filter((pred) => shape.reached.has(pred))
        const sets = from.flatMap((pred) => {
            const set = dominators.get(pred)
            return set === undefined ? [] : [set]
        })
        const [first, ...others] = sets
        const common =
            key === start || first === undefined
                ? new Set<string>()
                : new Set([...first].filter((member) => others.every((set) => set.has(member))))
        dominators.set(key, new Set([...common, key]))
    }
    return dominators
}

/** Whether `to` is reached from `from` by the edges. */
const reaches = (shape: Shape, from: string, to: string): boolean => {
    const start = shape.byKey.get(from)
    if (start === undefined) return false
    const seen = new Set<string>()
    const pending = [...edgesOfStep(start)]
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
        if (key === to) return true
        const step = shape.byKey.get(key)
        if (step !== undefined && !seen.has(key)) {
            seen.add(key)
            pending.push(...edgesOfStep(step))
        }
    }
    return false
}

/** The problems of the keys and edges: duplicates, unknown targets, unreachable steps, a cycle. */
const shapeProblems = (spec: GraphSpecV2, shape: Shape): ReadonlyArray<Problem> => [
    ...duplicatesOf(spec.nodes.map((step) => step.key)).map((key): Problem => ({
        code: "GRAPH_NODE_DUPLICATE",
        at: `nodes.${key}`,
    })),
    ...spec.nodes.flatMap((step) =>
        edgesOfStep(step)
            .filter((to) => !shape.byKey.has(to))
            .map((to): Problem => ({ code: "GRAPH_TARGET_UNKNOWN", at: `nodes.${step.key}->${to}` })),
    ),
    ...spec.nodes
        .filter((step) => !shape.reached.has(step.key))
        .map((step): Problem => ({ code: "GRAPH_NODE_UNREACHABLE", at: `nodes.${step.key}` })),
    ...(shape.order === null ? [{ code: "GRAPH_CYCLE" as const, at: "nodes" }] : []),
]

/** A dotted field path of identifiers: what an item key is (`id`, `order.id`). */
const FIELD_PATH = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/

/** Whether a number is a whole number from 1 to `cap`. */
const wholeUpTo = (value: number, cap: number): boolean => Number.isInteger(value) && value >= 1 && value <= cap

/** Whether a checkpoint wait is one unit of a whole number within its bound. */
const everySound = (every: LoopEvery): boolean => {
    const units = Object.entries(every).filter((entry): entry is [string, number] => entry[1] !== undefined)
    const [only, ...others] = units
    if (only === undefined || others.length > 0) return false
    const [unit, amount] = only
    const cap = unit === "minutes" || unit === "hours" || unit === "days" ? LOOP_EVERY_BOUNDS[unit] : 0
    return typeof amount === "number" && wholeUpTo(amount, cap)
}

/** The route names a routing node step declares (its node's, else the routes it writes). */
const routeNamesOf = (step: GraphV2NodeStep, context: TemplateGraphContext): ReadonlyArray<string> =>
    context.nodes.get(step.step)?.routes?.names ?? Object.keys(step.routes ?? {})

/** Whether an item key is legal as written: a dotted field path, or `"."` (the item itself). */
const itemKeySound = (itemKey: string): boolean => itemKey === LOOP_ITEM_SELF_KEY || FIELD_PATH.test(itemKey)

/** The JSON types an item may be keyed by itself under `"."`: a text or a number (a number is keyed by its decimal text). */
const SELF_KEYED_TYPES: ReadonlySet<string> = new Set(["string", "number", "integer"])

/**
 * Whether an item schema can never be its own key: some branch of it (null included) is typed and is not a string or a number. An
 * untyped list, or an item of no known type, is judged at run (the engine stops the loop on an item with no identity).
 */
const itemNotSelfKeyable = (item: Json): boolean => {
    if (item === MISSING || item === UNTYPED) return false
    const type = item["type"]
    if (Array.isArray(type)) return type.some((one) => typeof one === "string" && !SELF_KEYED_TYPES.has(one))
    const options = item["anyOf"] ?? item["oneOf"]
    if (Array.isArray(options)) return options.filter(isRecord).some((option) => itemNotSelfKeyable(option))
    const kind = typeOfSchema(item)
    return kind !== "unknown" && !SELF_KEYED_TYPES.has(kind)
}

/** The problems of an `over` loop's own params. */
const overProblems = (
    step: GraphV2LoopOverStep,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
    at: string,
): ReadonlyArray<Problem> => [
    ...(step.params.collect !== undefined && !collectSound(step, step.params.collect, shape)
        ? [{ code: "LOOP_COLLECT_UNKNOWN" as const, at: `${at}.params.collect` }]
        : []),
    ...(wholeUpTo(step.params.max, LOOP_OVER_CAP)
        ? []
        : [{ code: "LOOP_MAX_INVALID" as const, at: `${at}.params.max` }]),
    ...(wholeUpTo(step.params.concurrency, LOOP_CONCURRENCY_CAP)
        ? []
        : [{ code: "LOOP_CONCURRENCY_INVALID" as const, at: `${at}.params.concurrency` }]),
    ...(step.params.itemKey === undefined || itemKeySound(step.params.itemKey)
        ? []
        : [{ code: "LOOP_KEY_INVALID" as const, at: `${at}.params.itemKey` }]),
    ...(step.params.itemKey === LOOP_ITEM_SELF_KEY && itemNotSelfKeyable(itemSchemaOf(step, spec, shape, context))
        ? [{ code: "LOOP_KEY_NOT_SCALAR" as const, at: `${at}.params.itemKey` }]
        : []),
]

/** The problems of an `until` loop's own params: its cap, its ends, its checkpoint wait, the body route it stops on. */
const untilProblems = (
    step: GraphV2LoopUntilStep,
    shape: Shape,
    context: TemplateGraphContext,
    at: string,
): ReadonlyArray<Problem> => {
    const until = step.params.until
    const routeSound = (): boolean => {
        if (!isUntilRoute(until)) return true
        const target = shape.byKey.get(until.route)
        return (
            target?.kind === "node" &&
            target.loop === step.key &&
            target.routeBy !== undefined &&
            routeNamesOf(target, context).includes(until.stop)
        )
    }
    // A body that parks at a `wait` may run up to `LOOP_UNTIL_WAIT_CAP` rounds; any other `until` body up to `LOOP_UNTIL_CAP` (R9).
    const bodyParks = [...shape.byKey.values()].some((one) => one.loop === step.key && one.kind === "wait")
    const roundCap = bodyParks ? LOOP_UNTIL_WAIT_CAP : LOOP_UNTIL_CAP
    return [
        ...(wholeUpTo(step.params.max, roundCap)
            ? []
            : [{ code: "LOOP_MAX_INVALID" as const, at: `${at}.params.max` }]),
        ...(typeof step.routes.exhausted === "string" && step.routes.exhausted !== ""
            ? []
            : [{ code: "LOOP_EXHAUSTED_MISSING" as const, at: `${at}.routes.exhausted` }]),
        ...(typeof step.next === "string" && step.next !== ""
            ? []
            : [{ code: "LOOP_NEXT_MISSING" as const, at: `${at}.next` }]),
        ...(step.params.every === undefined || everySound(step.params.every)
            ? []
            : [{ code: "LOOP_EVERY_INVALID" as const, at: `${at}.params.every` }]),
        ...(routeSound() ? [] : [{ code: "LOOP_UNTIL_ROUTE_UNKNOWN" as const, at: `${at}.params.until` }]),
    ]
}

/** The problems of the loops: nesting, hand-offs in a body, their params, and edges that leave or enter a body. */
const loopProblems = (spec: GraphSpecV2, shape: Shape, context: TemplateGraphContext): ReadonlyArray<Problem> =>
    spec.nodes.flatMap((step): ReadonlyArray<Problem> => {
        const at = `nodes.${step.key}`
        const inBody = step.loop !== undefined
        const loop = step.loop === undefined ? undefined : shape.byKey.get(step.loop)
        const leaks = edgesOfStep(step).filter((to) => {
            const target = shape.byKey.get(to)
            if (target === undefined) return false
            if (step.kind === "loop" && to === step.routes.body) return target.loop !== step.key
            return target.loop !== step.loop
        })
        return [
            ...(inBody && loop?.kind !== "loop" ? [{ code: "LOOP_BODY_LEAK" as const, at: `${at}.loop` }] : []),
            ...(inBody && (step.kind === "call-workflow" || step.kind === "outcome")
                ? [{ code: "LOOP_BODY_HANDOFF" as const, at }]
                : []),
            ...(inBody && step.kind === "loop" ? [{ code: "LOOP_NESTED" as const, at }] : []),
            ...leaks.map((to): Problem => ({ code: "LOOP_BODY_LEAK", at: `${at}->${to}` })),
            ...(step.kind === "loop" && isLoopOver(step) ? overProblems(step, spec, shape, context, at) : []),
            ...(step.kind === "loop" && isLoopUntil(step) ? untilProblems(step, shape, context, at) : []),
            // Outside a body an `if` with no `yes` would end the run where the condition holds: never written (`endItem` is a body's).
            ...(!inBody && step.kind === "if" && step.routes.yes === undefined
                ? [{ code: "GRAPH_ROUTE_UNTARGETED" as const, at: `${at}.routes.yes` }]
                : []),
        ]
    })

const collectSound = (step: GraphV2LoopOverStep, collect: string, shape: Shape): boolean => {
    const collected = shape.byKey.get(collect)
    return collected?.kind === "node" && collected.loop === step.key
}

/**
 * The body steps of a loop where an iteration (an item, a round) may end: a node with no `next` (or a routing node with a route left
 * out), an `if` with a branch left out, any other step with no `next`.
 */
const iterationEndsOf = (
    loopKey: string,
    spec: GraphSpecV2,
    context: TemplateGraphContext,
): ReadonlyArray<GraphV2Step> =>
    spec.nodes.filter((step) => {
        if (step.loop !== loopKey) return false
        switch (step.kind) {
            case "node":
                if (step.routes === undefined) return step.next === undefined
                return routeNamesOf(step, context).some((name) => step.routes?.[name] === undefined)
            case "if":
                return step.routes.yes === undefined || step.routes.no === undefined
            case "loop":
            case "call-workflow":
            case "outcome":
            case "hand-back":
                return step.next === undefined
            case "wait":
                return waitRouteNamesOf(step).some((name) => step.routes[name] === undefined)
        }
    })
/**
 * The problems of a node step's providers against its node's, the agent's and the engine's lookups: one listed twice, one the node does
 * not list (a step only narrows or reorders: `GRAPH_ACCOUNT_WIDER`), one outside the agent's, one with an adapter for none of the node's
 * tools, and a tool the engine has no spec for. The step's MODE is never judged here: the workflow may set either (`nivo-frame.rights`).
 */
const accountProblems = (
    step: GraphV2NodeStep,
    node: AnyTemplateNode,
    context: TemplateGraphContext,
): ReadonlyArray<Problem> => {
    const at = `nodes.${step.key}.accounts`
    const declared = new Set<ProviderKey>(node.accounts)
    const agent = agentProvidersOf(context)
    const lookup = context.tools
    return [
        ...duplicatesOf(step.accounts).map((provider): Problem => ({
            code: "NODE_ACCOUNT_DUPLICATE",
            at: `${at}.${provider}`,
        })),
        ...step.accounts.flatMap((provider, position): ReadonlyArray<Problem> => {
            const here = `${at}.${position}.${provider}`
            return [
                ...(declared.has(provider) ? [] : [{ code: "GRAPH_ACCOUNT_WIDER" as const, at: here }]),
                ...(agent === null || agent.has(provider)
                    ? []
                    : [{ code: "NODE_ACCOUNT_NOT_OF_AGENT" as const, at: here }]),
                ...(lookup === undefined || node.tools.some((tool) => lookup.owns(provider, tool))
                    ? []
                    : [{ code: "NODE_ACCOUNT_PROVIDER_NOT_OWNER" as const, at: here }]),
            ]
        }),
        ...(lookup === undefined
            ? []
            : node.tools
                  .filter((tool) => !lookup.known(tool))
                  .map((tool): Problem => ({ code: "TOOL_UNKNOWN", at: `nodes.${step.key}.tools.${tool}` }))),
    ]
}

/**
 * The problems of a node step's routes against its node's route names. Inside a loop body a route left out is the end of the item (round)
 * (`endItem`, which the compile writes so); outside one every route name is written.
 */
const routeProblems = (step: GraphV2NodeStep, node: AnyTemplateNode): ReadonlyArray<Problem> => {
    const at = `nodes.${step.key}.routes`
    const names: ReadonlyArray<string> = node.routes?.names ?? []
    const written = Object.keys(step.routes ?? {})
    return [
        ...names
            .filter((name) => step.loop === undefined && !written.includes(name))
            .map((name): Problem => ({ code: "GRAPH_ROUTE_UNTARGETED", at: `${at}.${name}` })),
        ...written
            .filter((name) => !names.includes(name))
            .map((name): Problem => ({ code: "GRAPH_ROUTE_UNTARGETED", at: `${at}.${name}` })),
        ...(node.routes !== undefined && step.routeBy !== node.routes.by
            ? [{ code: "GRAPH_ROUTE_UNTARGETED" as const, at: `${at}.by` }]
            : []),
        ...(node.routes !== undefined && step.next !== undefined
            ? [{ code: "GRAPH_ROUTE_UNTARGETED" as const, at: `nodes.${step.key}.next` }]
            : []),
    ]
}

/** The JSON Schema of a contract type. */
const schemaOfContractType = (type: ContractType): Json => ({ type })

/** The schema of one input: its type, and for an input that states its members (a called workflow's `data`) those members, closed. */
const schemaOfInput = (input: GraphSpecV2["contract"]["inputs"][number]): Json =>
    input.members === undefined
        ? schemaOfContractType(input.type)
        : {
              type: "object",
              properties: Object.fromEntries(
                  input.members.map((member) => [member.name, schemaOfContractType(member.type)]),
              ),
              required: input.members.filter((member) => member.required).map((member) => member.name),
              additionalProperties: false,
          }

/** The trigger as one object holding one input: what a `trigger.<name>…` ref is read inside (an optional input may be left out). */
const triggerSchemaOf = (input: GraphSpecV2["contract"]["inputs"][number]): Json => ({
    type: "object",
    properties: { [input.name]: schemaOfInput(input) },
    required: input.required ? [input.name] : [],
    additionalProperties: false,
})

/** The schema an `over` loop answers: per item its key and the `collect` step's output (null when the item did not reach it, or no `collect`), and what was held. */
const loopOutputSchema = (collect: Json): Json => ({
    type: "object",
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                properties: { key: { type: "string" }, output: { anyOf: [collect, { type: "null" }] } },
                required: ["key", "output"],
                additionalProperties: false,
            },
        },
        held: {
            anyOf: [
                {
                    type: "object",
                    properties: { count: { type: "integer" }, firstKey: { type: "string" } },
                    required: ["count", "firstKey"],
                    additionalProperties: false,
                },
                { type: "null" },
            ],
        },
    },
    required: ["items", "held"],
    additionalProperties: false,
})

/**
 * The schema an `until` loop answers: the rounds it ran, whether its condition stopped it (false: it went `exhausted`), and `last`, the
 * output of the last node step that ran in the final round (null when none did). `last` is typed when the body has one place a round
 * ends and it is a node step (its output); otherwise it is untyped (judged at run).
 */
const untilOutputSchema = (last: Json): Json => ({
    type: "object",
    properties: {
        rounds: { type: "integer" },
        stopped: { type: "boolean" },
        last: last === UNTYPED ? UNTYPED : { anyOf: [last, { type: "null" }] },
    },
    required: ["rounds", "stopped", "last"],
    additionalProperties: false,
})

/** The schema of an `until` loop's `last`: the output of its one round-ending node step, else untyped. */
const lastSchemaOf = (
    step: GraphV2LoopUntilStep,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
): Json => {
    const [only, ...others] = iterationEndsOf(step.key, spec, context)
    if (only === undefined || others.length > 0 || only.kind !== "node") return UNTYPED
    return outputSchemaOf(only.key, spec, shape, context)
}

/** The output schema of a step, for refs into it; MISSING for a step that answers nothing (`if`). */
const outputSchemaOf = (key: string, spec: GraphSpecV2, shape: Shape, context: TemplateGraphContext): Json => {
    const step = shape.byKey.get(key)
    if (step === undefined) return MISSING
    switch (step.kind) {
        case "node": {
            const node = context.nodes.get(step.step)
            return node === undefined ? UNTYPED : jsonSchemaOf(node.output, "output")
        }
        case "loop":
            if (isLoopUntil(step)) return untilOutputSchema(lastSchemaOf(step, spec, shape, context))
            return loopOutputSchema(
                step.params.mode === "over" && step.params.collect !== undefined
                    ? outputSchemaOf(step.params.collect, spec, shape, context)
                    : { type: "null" },
            )
        case "outcome":
            return {
                type: "object",
                properties: { outcome: { type: "string" }, values: { type: "object" } },
                required: ["outcome", "values"],
                additionalProperties: false,
            }
        case "call-workflow":
            return UNTYPED
        case "if":
        case "hand-back":
            return MISSING
        case "wait":
            return waitOutputSchema(step, context)
    }
}

/** The route names a wait must target: one per trigger key, and `timeout`. */
const waitRouteNamesOf = (step: GraphV2WaitStep): ReadonlyArray<string> => [
    ...step.params.on.map((on) => on.key),
    WAIT_TIMEOUT_ROUTE,
]

/**
 * The schema of the members a waited verb's event supplies (its engine road, as the lookup knows it: each member the verb supplies is
 * there, no other), or an open object when the lookup knows none (judged at run).
 */
const waitEventSchema = (verb: TriggerVerb, context: TemplateGraphContext): Json => {
    const supplied = context.triggers?.supplies(verb)
    if (supplied?.kind !== "fixed") return { type: "object" }
    return {
        type: "object",
        properties: Object.fromEntries(supplied.params.map((param) => [param.name, schemaOfContractType(param.type)])),
        required: supplied.params.map((param) => param.name),
        additionalProperties: false,
    }
}

/**
 * The schema a wait answers: `{ trigger: <key>, event: <the members its verb supplies> }` for each trigger, `{ trigger: "timeout" }`
 * when the time ran out. A step reached only along a key's route reads `event` as that key's (the union narrows on `trigger`).
 */
const waitOutputSchema = (step: GraphV2WaitStep, context: TemplateGraphContext): Json => ({
    anyOf: [
        ...step.params.on.map((on) => ({
            type: "object",
            properties: { [WAIT_ROUTE_MEMBER]: { const: on.key }, event: waitEventSchema(on.verb, context) },
            required: [WAIT_ROUTE_MEMBER, "event"],
            additionalProperties: false,
        })),
        {
            type: "object",
            properties: { [WAIT_ROUTE_MEMBER]: { const: WAIT_TIMEOUT_ROUTE } },
            required: [WAIT_ROUTE_MEMBER],
            additionalProperties: false,
        },
    ],
})

/** A key of a wait's trigger as the route and the output name it: lower-case words joined by `-` or `_`. */
const WAIT_KEY = /^[a-z][a-z0-9_-]{0,31}$/

/**
 * Whether a verb can wake the agent: an engine verb (the lookup knows its engine road), or a provider-backed verb some provider of the
 * agent serves. Unknown (no lookup, or no agent providers given): it can.
 */
const waitServed = (verb: TriggerVerb, context: TemplateGraphContext): boolean => {
    const lookup = context.triggers
    if (lookup === undefined) return true
    if (lookup.carriedBy?.(verb) === "engine") return lookup.supplies(verb).kind !== "unknown"
    const agent = context.agentAccounts
    if (agent === undefined) return true
    return agent.some((provider) => lookup.supplies(verb, provider).kind !== "unknown")
}

/**
 * The problems of the waits: no trigger, or more than `WAIT_TRIGGERS_MAX` (`WAIT_TRIGGERS_EMPTY`, `WAIT_TRIGGERS_TOO_MANY`), a key
 * written twice, not a word, or `timeout` (`WAIT_KEY_DUPLICATE`, `WAIT_KEY_INVALID`), a key or `timeout` with no route and a route of
 * no key (`WAIT_ROUTE_MISSING`, `WAIT_ROUTE_UNKNOWN`), a timeout out of bounds (`WAIT_TIMEOUT_INVALID`: one unit, a whole number,
 * minutes 1-1440, hours 1-720, days 1-30: the bounds of `loop` `every`), and a verb the agent's accounts cannot serve
 * (`WAIT_TRIGGER_UNSERVED`).
 */
const waitProblems = (spec: GraphSpecV2, context: TemplateGraphContext): ReadonlyArray<Problem> =>
    spec.nodes.flatMap((step): ReadonlyArray<Problem> => {
        if (step.kind !== "wait") return []
        const at = `nodes.${step.key}`
        const on: ReadonlyArray<GraphV2WaitOn> = step.params.on
        const keys = on.map((entry) => entry.key)
        const names = new Set(waitRouteNamesOf(step))
        // In an `until` body a route left out (`endRound`) ends the round with the wait's output (the engine's round end).
        const owner = step.loop === undefined ? undefined : spec.nodes.find((one) => one.key === step.loop)
        const endsRound = owner?.kind === "loop" && isLoopUntil(owner)
        return [
            ...(on.length === 0 ? [{ code: "WAIT_TRIGGERS_EMPTY" as const, at: `${at}.params.on` }] : []),
            ...(on.length > WAIT_TRIGGERS_MAX
                ? [{ code: "WAIT_TRIGGERS_TOO_MANY" as const, at: `${at}.params.on` }]
                : []),
            ...duplicatesOf(keys).map((key): Problem => ({ code: "WAIT_KEY_DUPLICATE", at: `${at}.params.on.${key}` })),
            ...keys
                .filter((key) => key === WAIT_TIMEOUT_ROUTE || !WAIT_KEY.test(key))
                .map((key): Problem => ({ code: "WAIT_KEY_INVALID", at: `${at}.params.on.${key}` })),
            ...[...names]
                .filter((name) => step.routes[name] === "" || (step.routes[name] === undefined && !endsRound))
                .map((name): Problem => ({ code: "WAIT_ROUTE_MISSING", at: `${at}.routes.${name}` })),
            ...Object.keys(step.routes)
                .filter((name) => !names.has(name))
                .map((name): Problem => ({ code: "WAIT_ROUTE_UNKNOWN", at: `${at}.routes.${name}` })),
            ...(everySound(step.params.timeout)
                ? []
                : [{ code: "WAIT_TIMEOUT_INVALID" as const, at: `${at}.params.timeout` }]),
            ...on
                .filter((entry) => !waitServed(entry.verb, context))
                .map((entry): Problem => ({ code: "WAIT_TRIGGER_UNSERVED", at: `${at}.params.on.${entry.key}` })),
        ]
    })

/** Where a ref sits and what the step it sits in may see. */
interface RefSite {
    /** The step the ref belongs to. */
    readonly step: GraphV2Step
    /** Where the ref sits in the document, as a dotted path. */
    readonly at: string
    /** The schema the value must fit, or UNTYPED. */
    readonly target: Json
    /** The ref itself. */
    readonly ref: StoredRef
    /**
     * Whether the site takes what a ref that finds nothing (and has no `default`) resolves to: left out at the top or inside an object
     * (`resolveParams`), so the member must be optional; null inside a list, so the member must admit null. True where it is untyped.
     */
    readonly takesNothing: boolean
}

/** Whether a site's schema takes null: it admits null, or says nothing of its type. */
const takesNull = (target: Json): boolean =>
    target === UNTYPED || admitsNull(target) || typeOfSchema(target) === "unknown"

/**
 * Whether the value a ref reads may be nothing at run time: its source may not run (a side step, a step that does not dominate) or it
 * holds null or leaves the member out.
 */
const mayReadNothing = (
    ref: StoredRef,
    step: GraphV2Step,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
    dominated: boolean,
): boolean => {
    const parsed = parseRef(ref.$ref)
    if (parsed === null) return false
    switch (parsed.root) {
        case "trigger": {
            const [name] = parsed.path
            const input = spec.contract.inputs.find((entry) => entry.name === name)
            if (input === undefined) return false
            return readAt(triggerSchemaOf(input), parsed.path, shape.factsAt(step.key, "trigger")).nothing
        }
        case "steps": {
            const source = parsed.nodeKey === null ? undefined : shape.byKey.get(parsed.nodeKey)
            if (source === undefined || parsed.part !== "output") return false
            const facts = shape.factsAt(step.key, `steps.${source.key}`)
            // A step the road proves ran (a fact holds a value of it present) is read, dominated or not.
            const skippable =
                (!dominated || (source.kind === "node" && source.blocking === false)) && !presentAt(facts, [])
            return skippable || readAt(outputSchemaOf(source.key, spec, shape, context), parsed.path, facts).nothing
        }
        case "item": {
            const loop = loopOfStep(step, shape)
            if (loop === null || !isLoopOver(loop)) return false
            const [first] = parsed.path
            if (first === "$index") return false
            return readAt(itemSchemaOf(loop, spec, shape, context), parsed.path, shape.factsAt(step.key, "item"))
                .nothing
        }
        case "lead":
        case "workflows":
        case "out":
            return false
    }
}

/**
 * Whether a ref that may read nothing still fits its site: a non-null `default` always does; a null `default` where the site takes null;
 * no `default` where the site takes what an unfilled ref resolves to (left out, or null in a list).
 */
const nothingFits = (site: RefSite): boolean => {
    const fallback = site.ref.default
    if (fallback !== undefined && fallback !== null) return true
    return fallback === null ? takesNull(site.target) : site.takesNothing
}

/** The loop a body step belongs to, or null. */
const loopOfStep = (step: GraphV2Step, shape: Shape): GraphV2LoopStep | null => {
    const loop = step.loop === undefined ? undefined : shape.byKey.get(step.loop)
    return loop?.kind === "loop" ? loop : null
}

/** The schema of an item of a loop: the element schema of its list. */
const itemSchemaOf = (
    loop: GraphV2LoopOverStep,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
): Json => {
    const list = sourceSchemaOf(loop.params.items, loop, spec, shape, context)
    if (list === MISSING || list === UNTYPED) return list
    const items = list["items"]
    return list["type"] === "array" && isRecord(items) ? items : UNTYPED
}

/** The schema a `trigger.<member>` ref reads: a declared input, a system member (untyped) or MISSING. */
const triggerRefSchema = (path: ReadonlyArray<string>, step: GraphV2Step, spec: GraphSpecV2, shape: Shape): Json => {
    const [name] = path
    if (name === undefined) return UNTYPED
    const input = spec.contract.inputs.find((entry) => entry.name === name)
    if (input !== undefined) return readAt(triggerSchemaOf(input), path, shape.factsAt(step.key, "trigger")).schema
    return TRIGGER_SYSTEM_MEMBERS.includes(name) ? UNTYPED : MISSING
}

/** The schema an `item.<member>` ref reads inside a loop body: `$index`, `$round` of an `until` body, or a member of the item. */
const itemRefSchema = (
    path: ReadonlyArray<string>,
    step: GraphV2Step,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
): Json => {
    const loop = loopOfStep(step, shape)
    if (loop === null) return MISSING
    const [first, ...rest] = path
    if (first === "$index") return rest.length === 0 ? { type: "integer" } : MISSING
    // An `until` body has rounds, not items: `item.$round` (from 1) and `item.$index` only.
    if (!isLoopOver(loop)) return first === "$round" && rest.length === 0 ? { type: "integer" } : MISSING
    if (first === "$round") return MISSING
    return readAt(itemSchemaOf(loop, spec, shape, context), path, shape.factsAt(step.key, "item")).schema
}

/** The schema a ref reads, or MISSING; never judges upstream-ness (`refProblems` does). */
const sourceSchemaOf = (
    ref: StoredRef,
    step: GraphV2Step,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
): Json => {
    const parsed = parseRef(ref.$ref)
    if (parsed === null) return MISSING
    switch (parsed.root) {
        case "trigger":
            return triggerRefSchema(parsed.path, step, spec, shape)
        case "lead":
            return UNTYPED
        case "steps":
            if (parsed.part !== "output" || parsed.nodeKey === null) return MISSING
            return readAt(
                outputSchemaOf(parsed.nodeKey, spec, shape, context),
                parsed.path,
                shape.factsAt(step.key, `steps.${parsed.nodeKey}`),
            ).schema
        case "item":
            return itemRefSchema(parsed.path, step, spec, shape, context)
        case "workflows":
        case "out":
            return MISSING
    }
}

/** Every ref inside a binding, with the path below the member it sits at. */
const refsIn = (
    binding: ParamBinding,
    path: ReadonlyArray<string>,
): ReadonlyArray<{ readonly ref: StoredRef; readonly path: ReadonlyArray<string> }> => {
    if (isParamRef(binding)) return [{ ref: binding, path }]
    if (Array.isArray(binding))
        return binding.flatMap((member: ParamBinding, index) => refsIn(member, [...path, String(index)]))
    if (isRecord(binding))
        return Object.entries(binding).flatMap(([name, member]) =>
            isBindingValue(member) ? refsIn(member, [...path, name]) : [],
        )
    return []
}

/** Whether a member of a parsed record is a binding (always, for parsed JSON); the guard keeps `unknown` out. */
const isBindingValue = (value: unknown): value is ParamBinding =>
    value === null || ["string", "number", "boolean", "object"].includes(typeof value)

/** Whether a binding holds a ref anywhere. */
const holdsRef = (binding: ParamBinding): boolean => refsIn(binding, []).length > 0

/** The schema of a member of a node's input or params (input first), or null when neither has it. */
const memberSchemaOf = (node: AnyTemplateNode, member: string): z.ZodType | null => {
    for (const schema of [node.input, node.params]) {
        if (schema instanceof z.ZodObject) {
            const field: unknown = Reflect.get(schema.shape, member)
            if (field instanceof z.ZodType) return field
        }
    }
    return null
}

/** The members of an object schema a value must be given for. */
const requiredMembersOf = (schema: z.ZodType | undefined): ReadonlyArray<string> =>
    schema instanceof z.ZodObject
        ? Object.entries(schema.shape).flatMap(([name, field]) =>
              field instanceof z.ZodType && !field.safeParse(undefined).success ? [name] : [],
          )
        : []

/**
 * Whether a node member takes what a ref at `path` inside it resolves to when it finds nothing and has no `default`: at the top the member
 * is left out (the member must be optional or defaulted); inside an object the key is left out (it must not be required); inside a list
 * the entry is null (it must admit null).
 */
const takesNothingAt = (member: z.ZodType, memberJson: Json, path: ReadonlyArray<string>, target: Json): boolean => {
    const last = path.at(-1)
    if (last === undefined) return member.safeParse(undefined).success
    const [parent, ...others] = branchesOf(schemaAt(memberJson, path.slice(0, -1)))
    if (parent === undefined || others.length > 0 || parent === UNTYPED) return true
    if (parent["type"] === "array") return takesNull(target)
    const required = parent["required"]
    return !(Array.isArray(required) && required.includes(last))
}

/** The sites of the refs of a step, with the schema each must fit. */
const sitesOf = (step: GraphV2Step, context: TemplateGraphContext): ReadonlyArray<RefSite> => {
    const at = `nodes.${step.key}.params`
    const untypedSites = (bindings: ParamBindings, under: string): ReadonlyArray<RefSite> =>
        Object.entries(bindings).flatMap(([member, binding]) =>
            refsIn(binding, []).map(({ ref, path }) => ({
                step,
                at: [`${at}.${under}${member}`, ...path].join("."),
                target: UNTYPED,
                ref,
                takesNothing: true,
            })),
        )
    switch (step.kind) {
        case "node": {
            const node = context.nodes.get(step.step)
            return Object.entries(step.params).flatMap(([member, binding]) => {
                const schema = node === undefined ? null : memberSchemaOf(node, member)
                const memberJson = schema === null ? UNTYPED : jsonSchemaOf(schema, "input")
                return refsIn(binding, []).map(({ ref, path }) => {
                    const target = schemaAt(memberJson, path)
                    return {
                        step,
                        at: [`${at}.${member}`, ...path].join("."),
                        target,
                        ref,
                        takesNothing: schema === null || takesNothingAt(schema, memberJson, path, target),
                    }
                })
            })
        }
        case "if":
            return exprRefsOf(step.params.when).map((ref, index) => ({
                step,
                at: `${at}.when.${index}`,
                target: UNTYPED,
                ref,
                takesNothing: true,
            }))
        case "loop": {
            const params = step.params
            if (params.mode === "over")
                return [{ step, at: `${at}.items`, target: { type: "array" }, ref: params.items, takesNothing: true }]
            if (isUntilRoute(params.until)) return []
            return exprRefsOf(params.until).map((ref, index) => ({
                step,
                at: `${at}.until.${index}`,
                target: UNTYPED,
                ref,
                takesNothing: true,
            }))
        }
        case "call-workflow":
            return untypedSites(step.params.inputs, "inputs.")
        case "outcome":
            return untypedSites(step.params.outputs, "outputs.")
        case "hand-back":
            return []
        case "wait":
            // A match value read from the run when the wait begins: a text for `contains`, any value for `eq`.
            return step.params.on.flatMap((on) =>
                (on.match ?? []).flatMap((test, index): ReadonlyArray<RefSite> =>
                    isParamRef(test.value)
                        ? [
                              {
                                  step,
                                  at: `${at}.on.${on.key}.match.${index}`,
                                  target: test.op === "contains" ? { type: "string" } : UNTYPED,
                                  ref: test.value,
                                  takesNothing: true,
                              },
                          ]
                        : [],
                ),
            )
    }
}

/** Whether a body step is visible to an `until` condition, and whether it ran in every round. */
interface UntilBodyRead {
    /** Whether the read step is a body step an `until` condition may read. */
    readonly visible: boolean
    /** Whether the read step ran in every round (it dominates every place a round ends). */
    readonly dominated: boolean
}

/**
 * Whether a ref of an `until` loop's condition into its own body may be read, and whether the step it reads ran in every round: a ref
 * in `until` reads the round just run, so a body step is visible; it is dominated when it dominates every place a round ends.
 */
const untilBodyRead = (
    loop: GraphV2Step,
    source: GraphV2Step,
    spec: GraphSpecV2,
    context: TemplateGraphContext,
    dominators: ReadonlyMap<string, ReadonlySet<string>>,
): UntilBodyRead => {
    if (loop.kind !== "loop" || loop.params.mode !== "until" || source.loop !== loop.key)
        return { visible: false, dominated: false }
    const ends = iterationEndsOf(loop.key, spec, context)
    return {
        visible: true,
        dominated: ends.length > 0 && ends.every((end) => dominators.get(end.key)?.has(source.key) === true),
    }
}

/** What the upstream check of a `steps.<key>` ref finds: the problem it is, and whether an `until` body proves its step ran every round. */
interface StepRefCheck {
    /** The problem the ref has, or null when it is upstream and dominated or defaulted. */
    readonly problem: Problem | null
    /** Whether an `until` body proves the step ran every round; null when the ref reads no such body. */
    readonly untilDominated: boolean | null
}

/** Judges a `steps.<key>` ref at a site: the step must be upstream (or in the `until` body being read) and dominate the site or the ref carry a default. */
const stepRefCheck = (
    step: GraphV2Step,
    nodeKey: string,
    site: RefSite,
    spec: GraphSpecV2,
    shape: Shape,
    context: TemplateGraphContext,
    dominators: ReadonlyMap<string, ReadonlySet<string>>,
): StepRefCheck => {
    const target = shape.byKey.get(nodeKey)
    // A ref to the ROUND BEFORE (R13): a step of the same `until` body, with a default (round 1 reads it); never upstream-checked.
    if (site.ref.round === "previous") {
        const loopStep = step.loop === undefined ? undefined : shape.byKey.get(step.loop)
        const sound =
            target !== undefined &&
            step.loop !== undefined &&
            target.loop === step.loop &&
            loopStep?.kind === "loop" &&
            loopStep.params.mode === "until" &&
            site.ref.default !== undefined
        return {
            problem: sound ? null : { code: "GRAPH_REF_ROUND_INVALID", at: `${site.at}<-${site.ref.$ref}` },
            untilDominated: null,
        }
    }
    const intoBody = target === undefined ? null : untilBodyRead(step, target, spec, context, dominators)
    const untilDominated = intoBody?.visible === true ? intoBody.dominated : null
    const visible =
        intoBody?.visible === true ||
        (target !== undefined &&
            nodeKey !== step.key &&
            nodeKey !== step.loop &&
            reaches(shape, nodeKey, step.key) &&
            (target.loop === undefined || target.loop === step.loop))
    const at = `${site.at}<-${site.ref.$ref}`
    if (!visible) return { problem: { code: "GRAPH_REF_NOT_UPSTREAM", at }, untilDominated }
    const dominated = untilDominated ?? dominators.get(step.key)?.has(nodeKey) === true
    if (!dominated && site.ref.default === undefined)
        return { problem: { code: "GRAPH_REF_NOT_DOMINATOR", at }, untilDominated }
    return { problem: null, untilDominated }
}

/** The problems of the refs: malformed, not upstream, not a dominator without a default, a member the source lacks, a type that does not fit. */
const refProblems = (spec: GraphSpecV2, shape: Shape, context: TemplateGraphContext): ReadonlyArray<Problem> => {
    if (shape.order === null) return []
    const dominators = dominatorsOf(spec.nodes[0].key, shape, shape.order)
    return spec.nodes.flatMap((step) =>
        sitesOf(step, context).flatMap((site): ReadonlyArray<Problem> => {
            const parsed = parseRef(site.ref.$ref)
            if (parsed === null) return [{ code: "GRAPH_REF_TYPE", at: `${site.at}<-${site.ref.$ref}` }]
            if (parsed.root === "item" && step.loop === undefined)
                return [{ code: "GRAPH_REF_NOT_UPSTREAM", at: `${site.at}<-${site.ref.$ref}` }]
            let untilDominated: boolean | null = null
            if (parsed.root === "steps" && parsed.nodeKey !== null) {
                const check = stepRefCheck(step, parsed.nodeKey, site, spec, shape, context, dominators)
                if (check.problem !== null) return [check.problem]
                untilDominated = check.untilDominated
            }
            const found = sourceSchemaOf(site.ref, step, spec, shape, context)
            if (found === MISSING) return [{ code: "GRAPH_REF_TYPE", at: `${site.at}<-${site.ref.$ref}` }]
            const dominated =
                untilDominated ??
                (parsed.root !== "steps" ||
                    parsed.nodeKey === null ||
                    dominators.get(step.key)?.has(parsed.nodeKey) === true)
            // Nullability: a ref that may read nothing (a null or optional source, a side step, a step that does not dominate) must fit its
            // site with what it then resolves to: its default, or the member left out (null inside a list).
            const nothing =
                context.nullability === "strict" &&
                mayReadNothing(site.ref, step, spec, shape, context, dominated) &&
                !nothingFits(site)
            return fits(typeOfSchema(site.target), typeOfSchema(found)) && !nothing
                ? []
                : [{ code: "GRAPH_REF_TYPE", at: `${site.at}<-${site.ref.$ref}` }]
        }),
    )
}

/** The kind of value a JSON Schema holds, for an expression: a date-time / date string is a `date`. */
const kindOfSchema = (schema: Json): ExprValueKind => {
    if (schema === MISSING) return "missing"
    if (schema === UNTYPED) return "unknown"
    const type = typeOfSchema(schema)
    switch (type) {
        case "integer":
        case "number":
            return "number"
        case "string":
            return branchesOf(schema).some((branch) => branch["format"] === "date-time" || branch["format"] === "date")
                ? "date"
                : "string"
        case "boolean":
        case "object":
        case "array":
        case "null":
        case "unknown":
            return type
    }
}

/**
 * The problems of the expressions (`if`, `until`): bounds and type mismatches, by `exprProblems`, each ref typed from its source. A ref
 * that reads nothing is `refProblems`' (`GRAPH_REF_TYPE`), so it is unknown here and never reported twice.
 */
const expressionProblems = (spec: GraphSpecV2, shape: Shape, context: TemplateGraphContext): ReadonlyArray<Problem> =>
    spec.nodes.flatMap((step): ReadonlyArray<Problem> => {
        const kindOf = (ref: StoredRef): ExprValueKind => {
            const kind = kindOfSchema(sourceSchemaOf(ref, step, spec, shape, context))
            return kind === "missing" ? "unknown" : kind
        }
        if (step.kind === "if") return exprProblems(step.params.when, { at: `nodes.${step.key}.params.when`, kindOf })
        if (step.kind === "loop" && step.params.mode === "until" && !isUntilRoute(step.params.until))
            return exprProblems(step.params.until, { at: `nodes.${step.key}.params.until`, kindOf })
        return []
    })

/** The problems of a node step's bindings: unknown members, required ones unbound, fixed values the schema refuses. */
const bindingProblems = (step: GraphV2NodeStep, node: AnyTemplateNode): ReadonlyArray<Problem> => {
    const at = `nodes.${step.key}.params`
    const bound = new Set(Object.keys(step.params))
    const required = [...requiredMembersOf(node.input), ...requiredMembersOf(node.params)]
    return [
        ...required
            .filter((member) => !bound.has(member))
            .map((member): Problem => ({ code: "GRAPH_INPUT_UNBOUND", at: `${at}.${member}` })),
        ...Object.entries(step.params).flatMap(([member, binding]): ReadonlyArray<Problem> => {
            const schema = memberSchemaOf(node, member)
            if (schema === null) return [{ code: "GRAPH_PARAM_INVALID", at: `${at}.${member}` }]
            return holdsRef(binding) || schema.safeParse(binding).success
                ? []
                : [{ code: "GRAPH_PARAM_INVALID", at: `${at}.${member}` }]
        }),
    ]
}

/** The problems of the node steps. */
const nodeStepProblems = (spec: GraphSpecV2, context: TemplateGraphContext): ReadonlyArray<Problem> =>
    spec.nodes.flatMap((step): ReadonlyArray<Problem> => {
        if (step.kind !== "node") return []
        const node = context.nodes.get(step.step)
        if (node === undefined) return [{ code: "NODE_UNKNOWN", at: `nodes.${step.key}` }]
        const writes = context.tools?.writes
        return [
            ...accountProblems(step, node, context),
            // The step's mode (the node's, or the workflow's own for its step): on `ask` its node holds at most one write tool.
            ...(writes === undefined
                ? []
                : askWritesProblems(
                      { id: node.id, tools: node.tools, mode: step.mode },
                      writes,
                      `nodes.${step.key}.tools`,
                  )),
            ...routeProblems(step, node),
            ...bindingProblems(step, node),
        ]
    })

/**
 * The problems of what one road of a trigger supplies (`at` names the trigger, or the trigger's provider): an unknown verb or a
 * provider that does not serve it, a required input of the graph it does not supply, or supplies with another type.
 */
const supplyProblems = (
    supply: TriggerSupply | undefined,
    required: ReadonlyArray<GraphSpecV2["contract"]["inputs"][number]>,
    at: string,
    unknownAt: string,
): ReadonlyArray<Problem> => {
    if (supply === undefined || supply.kind === "caller") return []
    if (supply.kind === "unknown") return [{ code: "TRIGGER_UNKNOWN", at: unknownAt }]
    return required.flatMap((input): ReadonlyArray<Problem> => {
        const given = supply.params.find((param) => param.name === input.name)
        if (given === undefined) return [{ code: "TRIGGER_INPUT_MISSING", at: `${at}.${input.name}` }]
        return contractTypeFits(input.type, given.type)
            ? []
            : [{ code: "TRIGGER_INPUT_TYPE", at: `${at}.${input.name}` }]
    })
}

/** The problems of one trigger's providers against the engine's lookup: a provider-backed verb with none, an engine verb with some. */
const accountRuleProblems = (
    entry: GraphSpecV2["triggers"][number],
    carried: TriggerCarrier | undefined,
    at: string,
): ReadonlyArray<Problem> => {
    const accounts = entry.accounts ?? []
    if (carried === "provider" && accounts.length === 0)
        return [{ code: "TRIGGER_ACCOUNT_MISSING", at: `${at}.${entry.verb}` }]
    if (carried === "engine")
        return accounts.map((account): Problem => ({
            code: "TRIGGER_ACCOUNT_NOT_EXPECTED",
            at: `${at}.accounts.${account}`,
        }))
    return []
}

/** The structural problems of one trigger's providers: one named twice, one outside the agent's. */
const triggerAccountProblems = (
    entry: GraphSpecV2["triggers"][number],
    agent: ReadonlySet<string> | null,
    at: string,
): ReadonlyArray<Problem> => {
    const seen = new Set<string>()
    return (entry.accounts ?? []).flatMap((account, index): ReadonlyArray<Problem> => {
        const twice = seen.has(account)
        seen.add(account)
        return [
            ...(twice
                ? [{ code: "TRIGGER_ACCOUNT_DUPLICATE" as const, at: `${at}.accounts.${index}.${account}` }]
                : []),
            ...(!twice && agent !== null && !agent.has(account)
                ? [{ code: "TRIGGER_PROVIDER_NOT_OF_AGENT" as const, at: `${at}.accounts.${account}` }]
                : []),
        ]
    })
}

/**
 * The problems of the triggers (owner key `triggerOneSource2026_11_12`, CORRECTED: one trigger per purpose, one source per STREAM, bound
 * by the engine in the workspace): a verb named twice (`TRIGGER_PURPOSE_DUPLICATE`, judged always: two sources of one purpose are one
 * trigger with several accounts), a provider listed twice or outside the agent's; given the engine's lookup, a provider-backed verb with
 * no provider or an engine verb with some, unknown verbs, and inputs a listed provider does not supply (`triggers.<i>.accounts.<provider>.<input>`,
 * every provider judged), or the verb's engine road when it lists none (`triggers.<i>.<input>`).
 */
const triggerProblems = (spec: GraphSpecV2, context: TemplateGraphContext): ReadonlyArray<Problem> => {
    const agent = agentProvidersOf(context)
    const required = spec.contract.inputs.filter((input) => input.required)
    const seen = new Set<TriggerVerb>()
    return spec.triggers.flatMap((entry, index): ReadonlyArray<Problem> => {
        const at = `triggers.${index}`
        const duplicate: ReadonlyArray<Problem> = seen.has(entry.verb)
            ? [{ code: "TRIGGER_PURPOSE_DUPLICATE", at: `${at}.${entry.verb}` }]
            : []
        seen.add(entry.verb)
        const structural: ReadonlyArray<Problem> = [...duplicate, ...triggerAccountProblems(entry, agent, at)]
        const lookup = context.triggers
        if (lookup === undefined) return structural
        const carried = lookup.carriedBy?.(entry.verb)
        const accountRule = accountRuleProblems(entry, carried, at)
        if (accountRule.length > 0) return [...structural, ...accountRule]
        const accounts = [...new Set(entry.accounts ?? [])]
        if (accounts.length === 0)
            return [...structural, ...supplyProblems(lookup.supplies(entry.verb), required, at, `${at}.${entry.verb}`)]
        const verbUnknown =
            carried === undefined
                ? lookup.supplies(entry.verb).kind === "unknown" &&
                  accounts.every((account) => lookup.supplies(entry.verb, account).kind === "unknown")
                : carried === "unknown"
        if (verbUnknown) return [...structural, { code: "TRIGGER_UNKNOWN", at: `${at}.${entry.verb}` }]
        return [
            ...structural,
            ...accounts.flatMap((account) => {
                const where = `${at}.accounts.${account}`
                return supplyProblems(lookup.supplies(entry.verb, account), required, where, where)
            }),
        ]
    })
}

/** The member of a trigger scope that names a person on an account: a verb that supplies it wakes a graph for that person. */
const PERSON_ROUTE_MEMBER = "routeId"

/** Whether a supply names a person on an account (it supplies `routeId`). */
const suppliesPerson = (supply: TriggerSupply): boolean =>
    supply.kind === "fixed" && supply.params.some((param) => param.name === PERSON_ROUTE_MEMBER)

/**
 * The hand-offs that keep a person's run open: in a graph one of whose triggers supplies `routeId` (for its engine road or any of its
 * accounts, as the engine's lookup says), a `callWorkflow` step with a `next` (`GRAPH_HANDOFF_NOT_LAST`). Such a graph hands the person on
 * and ENDS; later events of the person go to the callee's waits first (owner's final rule 2a, 6). Judged only with the engine's lookup.
 */
const handoffProblems = (spec: GraphSpecV2, context: TemplateGraphContext): ReadonlyArray<Problem> => {
    const lookup = context.triggers
    if (lookup === undefined) return []
    const person = spec.triggers.some(
        (entry) =>
            suppliesPerson(lookup.supplies(entry.verb)) ||
            (entry.accounts ?? []).some((account) => suppliesPerson(lookup.supplies(entry.verb, account))),
    )
    if (!person) return []
    return spec.nodes
        .filter((step) => step.kind === "call-workflow" && step.next !== undefined && step.next !== null)
        .map((step): Problem => ({ code: "GRAPH_HANDOFF_NOT_LAST", at: `nodes.${step.key}` }))
}

/** The ref of an `until` body's round number (the builder's `round()`). */
const ROUND_REF = "item.$round"

/** Whether a condition reads the round number alone (every ref it reads is `item.$round`): within one round it has one value. */
const readsRoundOnly = (when: StoredExpr): boolean => {
    const refs = exprRefsOf(when)
    return refs.length > 0 && refs.every((ref) => ref.$ref === ROUND_REF)
}

/**
 * Whether some road from `start` reaches `target` without passing `avoid`. A road is ONE round of its loop, so an `if` of that body whose
 * condition reads the round number alone takes the same branch wherever the same condition is written again on the road (a road that
 * takes `yes` of one and `no` of the other is no road): a talk loop whose round 1 skips its wait (`equals(round(), 1)`) and whose
 * hand-back is guarded by the same test hands back only in rounds that waited (R33).
 */
const reachesAvoiding = (
    start: string,
    target: string,
    avoid: string,
    loop: string | undefined,
    byKey: ReadonlyMap<string, GraphV2Step>,
): boolean => {
    const seen = new Set<string>()
    const go = (key: string, decided: ReadonlyMap<string, "yes" | "no">): boolean => {
        if (key === target) return true
        const step = byKey.get(key)
        const visit = `${key}|${JSON.stringify([...decided])}`
        if (key === avoid || step === undefined || seen.has(visit)) return false
        seen.add(visit)
        if (step.kind !== "if" || step.loop !== loop || loop === undefined || !readsRoundOnly(step.params.when))
            return forwardEdgesOf(step).some((to) => go(to, decided))
        const test = JSON.stringify(step.params.when)
        const taken = decided.get(test)
        return (["yes", "no"] as const).some((branch) => {
            const to = step.routes[branch]
            if (to === undefined || to === step.loop || (taken !== undefined && taken !== branch)) return false
            return go(to, new Map(decided).set(test, branch))
        })
    }
    return go(start, new Map())
}

/**
 * Whether a hand-back has an event to hand back (`GRAPH_HAND_BACK_NO_EVENT` otherwise): the step it names is a `wait` of the SAME round
 * (the same loop body, or both outside one), runs before it on every road of one round (no road reaches the hand-back without passing
 * the wait, `reachesAvoiding`), and the hand-back is not reached from the wait's `timeout` route (a timeout took no event). Structural
 * only; the engine refuses at run time what slips through (`hand_back_no_event`).
 */
const handBackHasEvent = (step: GraphV2HandBackStep, shape: Shape, start: string): boolean => {
    const wait = shape.byKey.get(step.params.wait)
    if (wait?.kind !== "wait" || wait.loop !== step.loop) return false
    if (!shape.reached.has(wait.key) || reachesAvoiding(start, step.key, wait.key, step.loop, shape.byKey)) return false
    const timeout = wait.routes[WAIT_TIMEOUT_ROUTE]
    return timeout === undefined || !reachedFrom(timeout, shape.byKey, () => false).has(step.key)
}

/** The hand-backs with no event to hand back (R11). Judged only on an acyclic graph (a cycle is its own problem). */
const handBackProblems = (spec: GraphSpecV2, shape: Shape): ReadonlyArray<Problem> => {
    if (shape.order === null) return []
    return spec.nodes.flatMap((step): ReadonlyArray<Problem> =>
        step.kind === "hand-back" && !handBackHasEvent(step, shape, spec.nodes[0].key)
            ? [{ code: "GRAPH_HAND_BACK_NO_EVENT", at: `nodes.${step.key}.params.wait` }]
            : [],
    )
}

/** Whether a text is an ISO 8601 instant (a date, `T`, a time) the platform can read. */
const isIsoInstant = (text: string): boolean => /^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(Date.parse(text))

/** The problems of the catalogue entry: a version that is not a whole number from 1, a `publishedAt` that is not an ISO 8601 instant. */
const catalogueProblems = (spec: GraphSpecV2): ReadonlyArray<Problem> => {
    const catalogue = spec.catalogue
    if (catalogue === undefined) return []
    return [
        ...(Number.isInteger(catalogue.version) && catalogue.version >= 1
            ? []
            : [{ code: "GRAPH_CATALOGUE_INVALID" as const, at: "catalogue.version" }]),
        ...(isIsoInstant(catalogue.publishedAt)
            ? []
            : [{ code: "GRAPH_CATALOGUE_INVALID" as const, at: "catalogue.publishedAt" }]),
    ]
}

/** The problems of the outcome steps against the declared outcomes: an undeclared name, outputs other than the declared ones. */
const outcomeProblems = (spec: GraphSpecV2): ReadonlyArray<Problem> =>
    spec.nodes.flatMap((step): ReadonlyArray<Problem> => {
        if (step.kind !== "outcome") return []
        const declared = spec.outcomes.find((entry) => entry.key === step.params.outcome)
        const names = Object.keys(step.params.outputs)
        const same =
            declared?.outputs.length === names.length && declared.outputs.every((output) => names.includes(output.name))
        return same ? [] : [{ code: "GRAPH_OUTCOME_MISMATCH", at: `nodes.${step.key}` }]
    })

/**
 * Every save problem of a @2 graph decidable here: its shape (duplicate keys, unknown targets, unreachable steps, a cycle), its loops
 * (nesting, hand-offs in a body, `collect`, edges leaving or entering a body), its node steps (unknown nodes; accounts wider than the
 * node's, not the agent's, or, given the engine's lookups, unknown tools, providers that do not own a tool, `auto` on a money tool;
 * routes untargeted; bindings unbound, unknown or refused), its refs (malformed, not upstream, not dominating without a default, a member
 * the source lacks, a type that does not fit), its triggers (a verb named twice, a provider listed twice or outside the agent's; given
 * the engine's lookup, providers missing or not expected, unknown verbs and required inputs a listed provider does not supply) and its
 * outcomes. Empty means it holds.
 */
export const templateGraphProblems = (spec: GraphSpecV2, context: TemplateGraphContext): ReadonlyArray<Problem> => {
    const shape = shapeOf(spec)
    return [
        ...shapeProblems(spec, shape),
        ...loopProblems(spec, shape, context),
        ...nodeStepProblems(spec, context),
        ...refProblems(spec, shape, context),
        ...expressionProblems(spec, shape, context),
        ...waitProblems(spec, context),
        ...handBackProblems(spec, shape),

        ...triggerProblems(spec, context),
        ...handoffProblems(spec, context),
        ...outcomeProblems(spec),
        ...catalogueProblems(spec),
    ]
}

/** The schema a ref reads in a step of a compiled graph; what compile reads to type the outcomes. */
export const refSchemaIn = (
    ref: StoredRef,
    step: GraphV2Step,
    spec: GraphSpecV2,
    context: TemplateGraphContext,
): Json => sourceSchemaOf(ref, step, spec, shapeOf(spec), context)
