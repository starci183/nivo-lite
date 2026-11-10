import { STOP_STEP, type GraphSpec, type GraphSpecNode, type GraphSpecWait } from "@nivo-lite/agent-sdk/graph"
import { BRANCH_FIELD, LOOP_BODY_ROUTE, LOOP_STEP, type NodeRole } from "@nivo-lite/agent-sdk/node"
import { THREAD_END } from "@modules/integrations/langgraph/langgraph.port"

/**
 * The name of the engine node every compiled graph carries: a step that cannot complete goes there, it stops the thread and the
 * founder's decision leaves it. No template draws it and no editor shows it; the name is fixed so a thread frozen on any version resumes.
 */
export const FREEZE_NODE = "__freeze"

/** The names a template key may not take: the keys of the port's `ThreadState`, which LangGraph refuses as node names. */
export const THREAD_STATE_KEYS: ReadonlyArray<string> = ["trigger", "steps", "trouble", "founderAnswers", "loop"]

/** What a graph node name may not contain (LangGraph keeps them for its checkpoint namespaces). */
const RESERVED_CHARACTERS: ReadonlyArray<string> = ["|", ":"]

/** The prefix of an engine name (`__freeze`, `__start__`, `__end__`): no template key may start with it. */
const ENGINE_PREFIX = "__"

/**
 * The version a thread is compiled from and stays on: a run is always compiled from the version it started on, because a resume on a
 * changed graph does nothing and says nothing (LangGraph 1.7.2). `versionId` is the compile cache key.
 */
export interface TemplatePin {
    /** The workflow version row the run is pinned to. */
    readonly versionId: string
    /** The workflow the version belongs to; null for a graph not saved as a workflow (a template compiled on its own). */
    readonly workflowId: string | null
    /** The version number. */
    readonly number: number
    /** The hash of the version's document, as the version row keeps it; null when the caller has none. */
    readonly documentHash: string | null
    /** The blocks-core template the version was made from (`chatbot.front-desk`); null for a graph the owner drew. */
    readonly templateId: string | null
    /** The template version it was made from; null with `templateId`. */
    readonly templateVersion: number | null
}

/** One workflow version to compile: the pin and the graph it holds. */
export interface TemplateSource {
    /** The version the thread is pinned to. */
    readonly pin: TemplatePin
    /** The graph of that version. */
    readonly spec: GraphSpec
}

/** Where a step goes when it completes: one fixed next node, or the route its answer's branch names. */
export type StepExit =
    | {
          /** One fixed node follows (or the end). */
          readonly kind: "next"
          /** The node key, or `THREAD_END`. */
          readonly to: string
      }
    | {
          /** The answer's branch picks the node. */
          readonly kind: "branch"
          /** The field of the step's output that names the branch. */
          readonly field: string
          /** The node key of each branch; a `stop` target is already `THREAD_END`. */
          readonly routes: Readonly<Record<string, string>>
          /** Where a branch with no route goes. */
          readonly otherwise: string
      }

/**
 * One step node of a compiled graph: the template node it runs and every place it may go. It becomes the port's `ThreadGraphNode`
 * `{ key, run, next, ends }` once the engine gives it a `run`.
 */
export interface CompiledStep {
    /** The template key: the node key of the thread graph and the step key of the projection rows. */
    readonly key: string
    /** The installed node id it runs. */
    readonly step: string
    /** The role the template gives it. */
    readonly kind: NodeRole
    /** The template's `blocking`, carried as written; absent takes the node's own. */
    readonly blocking?: boolean | undefined
    /** The template's wait, carried for the view; nothing acts on it in the engine today. */
    readonly wait?: GraphSpecWait | undefined
    /** Where it goes when it completes. */
    readonly exit: StepExit
    /**
     * Every node the step may go to: its exit targets and `FREEZE_NODE`. The step names it as the answer's `goto` (`stepExitOf`, or
     * `FREEZE_NODE` when it cannot complete), so a step that freezes never also follows its `next`.
     */
    readonly ends: ReadonlyArray<string>
}

/** The engine's freeze node: it interrupts, and the founder's decision sends the thread back to a step, to itself or to the end. */
export interface CompiledFreeze {
    /** `FREEZE_NODE`. */
    readonly key: string
    /** Every step key (retry, answer), itself (take over) and `THREAD_END` (skip). */
    readonly ends: ReadonlyArray<string>
}

/**
 * The description of one thread graph, plain data: the entry, each step node with every place it may go, and the freeze node. The
 * engine gives each a `run` and hands the port a `ThreadGraph` (`version` = `pin.versionId`); nothing here imports LangGraph.
 */
export interface CompiledTemplate {
    /** The version it was compiled from. */
    readonly pin: TemplatePin
    /** The node a new thread starts at: the template's first node. */
    readonly entry: string
    /** The step nodes, in template order, `stop` nodes left out (an edge to one is an edge to the end). */
    readonly nodes: ReadonlyArray<CompiledStep>
    /** The engine's freeze node. */
    readonly freeze: CompiledFreeze
}

/** Why a version does not compile. */
export type TemplateProblemCode =
    | "TEMPLATE_EMPTY"
    | "TEMPLATE_KEY_DUPLICATE"
    | "TEMPLATE_KEY_RESERVED"
    | "TEMPLATE_TARGET_UNKNOWN"
    | "TEMPLATE_STEP_UNKNOWN"
    | "TEMPLATE_LOOP_PHASE_2"

/** One problem and where it is: a node key, or `<from>-><to>` for an edge. */
export interface TemplateProblem {
    /** The reason; stable, so a caller can branch on it. */
    readonly code: TemplateProblemCode
    /** Where it is. */
    readonly at: string
}

/** A compiled graph, or the named reasons it was refused; never a graph that would end in silence. */
export type TemplateCompile =
    | {
          /** It compiled. */
          readonly kind: "compiled"
          /** The description. */
          readonly graph: CompiledTemplate
      }
    | {
          /** It was refused. */
          readonly kind: "refused"
          /** The version that was refused. */
          readonly pin: TemplatePin
          /** Every reason, in template order. */
          readonly problems: ReadonlyArray<TemplateProblem>
      }

/** Whether a node is the built-in `stop`, which runs nothing and ends the run. */
const isStop = (node: GraphSpecNode): boolean => node.step === STOP_STEP

/** The node name an edge to a key resolves to: the end for a `stop` node, else the key. */
const targetOf = (nodes: ReadonlyMap<string, GraphSpecNode>, key: string): string => {
    const node = nodes.get(key)
    return node === undefined || isStop(node) ? THREAD_END : key
}

/** Where a node goes when it completes, with the same reading as the engine's `nextKeyOf`: a branching node ignores its `next`. */
const exitOf = (nodes: ReadonlyMap<string, GraphSpecNode>, node: GraphSpecNode): StepExit => {
    const routes = Object.entries(node.routes ?? {}).filter(([branch]) => branch !== LOOP_BODY_ROUTE)
    if (routes.length === 0)
        return { kind: "next", to: node.next === undefined ? THREAD_END : targetOf(nodes, node.next) }
    return {
        kind: "branch",
        field: BRANCH_FIELD,
        routes: Object.fromEntries(routes.map(([branch, key]) => [branch, targetOf(nodes, key)])),
        otherwise: THREAD_END,
    }
}

/** The targets of an exit, without repeats. */
const targetsOf = (exit: StepExit): ReadonlyArray<string> =>
    exit.kind === "next" ? [exit.to] : [...new Set([...Object.values(exit.routes), exit.otherwise])]

/** Whether a key cannot be a node name: an engine prefix, a reserved character, or a key of the thread state. */
const isReserved = (key: string): boolean =>
    key.startsWith(ENGINE_PREFIX) ||
    RESERVED_CHARACTERS.some((character) => key.includes(character)) ||
    THREAD_STATE_KEYS.includes(key)

/** The problems of the keys and edges: none, duplicate, reserved, or an edge to a key the graph does not have. */
const shapeProblems = (spec: GraphSpec, nodes: ReadonlyMap<string, GraphSpecNode>): ReadonlyArray<TemplateProblem> => {
    const first = spec.nodes[0]
    if (first === undefined || isStop(first)) return [{ code: "TEMPLATE_EMPTY", at: spec.moduleKey }]
    const keys = spec.nodes.map((node) => node.key)
    return [
        ...[...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))].map(
            (at): TemplateProblem => ({ code: "TEMPLATE_KEY_DUPLICATE", at }),
        ),
        ...keys.filter((key) => isReserved(key)).map((at): TemplateProblem => ({ code: "TEMPLATE_KEY_RESERVED", at })),
        ...spec.nodes.flatMap((node) =>
            [...(node.next === undefined ? [] : [node.next]), ...Object.values(node.routes ?? {})]
                .filter((target) => !nodes.has(target))
                .map((target): TemplateProblem => ({ code: "TEMPLATE_TARGET_UNKNOWN", at: `${node.key}->${target}` })),
        ),
    ]
}

/** The problems of the steps: one not installed, or a for-each (a sequential cycle, phase 2 of the move). */
const stepProblems = (spec: GraphSpec, installed: ReadonlySet<string>): ReadonlyArray<TemplateProblem> =>
    spec.nodes.flatMap((node): ReadonlyArray<TemplateProblem> => {
        if (node.step === LOOP_STEP) return [{ code: "TEMPLATE_LOOP_PHASE_2", at: node.key }]
        if (isStop(node) || installed.has(node.step)) return []
        return [{ code: "TEMPLATE_STEP_UNKNOWN", at: node.key }]
    })

/** The step node of a template node. */
const nodeOf = (nodes: ReadonlyMap<string, GraphSpecNode>, node: GraphSpecNode): CompiledStep => {
    const exit = exitOf(nodes, node)
    return {
        key: node.key,
        step: node.step,
        kind: node.kind,
        ...(node.blocking === undefined ? {} : { blocking: node.blocking }),
        ...(node.wait === undefined ? {} : { wait: node.wait }),
        exit,
        ends: [...targetsOf(exit), FREEZE_NODE],
    }
}

/**
 * Compiles one workflow version into the description of a LangGraph StateGraph. Pure: the same version and the same installed steps
 * always give the same description. Refused, with every named reason, when a key, an edge or a step cannot run: an unknown step id,
 * a reserved key, or a for-each (phase 2). `installed` is the ids of the installed nodes (the node registry).
 */
export const compileTemplate = (source: TemplateSource, installed: ReadonlySet<string>): TemplateCompile => {
    const { pin, spec } = source
    const nodes = new Map(spec.nodes.map((node) => [node.key, node]))
    const problems = [...shapeProblems(spec, nodes), ...stepProblems(spec, installed)]
    const first = spec.nodes[0]
    if (problems.length > 0 || first === undefined) return { kind: "refused", pin, problems }
    const steps = spec.nodes.filter((node) => !isStop(node)).map((node) => nodeOf(nodes, node))
    return {
        kind: "compiled",
        graph: {
            pin,
            entry: first.key,
            nodes: steps,
            freeze: { key: FREEZE_NODE, ends: [...steps.map((step) => step.key), FREEZE_NODE, THREAD_END] },
        },
    }
}

/**
 * The node a completed step goes to, from its output: the fixed next node, or the route of the output's branch (`THREAD_END` for a
 * branch with no route or an output without one). The node function returns `Command({ goto: stepExitOf(node, output) })`.
 */
export const stepExitOf = (node: CompiledStep, output: unknown): string => {
    const { exit } = node
    if (exit.kind === "next") return exit.to
    const branch: unknown = typeof output === "object" && output !== null ? Reflect.get(output, exit.field) : undefined
    return typeof branch === "string" ? (exit.routes[branch] ?? exit.otherwise) : exit.otherwise
}
