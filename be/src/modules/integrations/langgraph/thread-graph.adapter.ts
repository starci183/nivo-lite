import {
    Annotation,
    Command,
    END,
    interrupt,
    Send,
    START,
    StateGraph,
    type LangGraphRunnableConfig,
} from "@langchain/langgraph"
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import {
    THREAD_CONFIG,
    THREAD_END,
    type ThreadGraph,
    type ThreadGraphNode,
    type ThreadNodeAnswer,
    type ThreadNodeScope,
    type ThreadRef,
} from "./langgraph.port"
import { requirePlain } from "./plain.policy"
import { branchInputOf, branchWriteRefusedOf, heldOf, mergeBranches, mergeSteps, writesOf } from "./thread-state.policy"

/** The key the library starts every graph from; no node may take it. */
const LIBRARY_START: string = START

/**
 * The channels of every thread: the keys of the shared state, then the engine's pin and cursor. `steps` and `branches` merge by key
 * (a reducer), so the branches of a fan-out, which run in one superstep, each write their own keys; every other channel takes one
 * value per superstep, and only a node of the shared state writes it. A branch's own value (`state.branch`) is no channel: it travels
 * in the input of its `Send`.
 */
const ThreadChannels = Annotation.Root({
    trigger: Annotation<unknown>(),
    steps: Annotation<Readonly<Record<string, unknown>>>({ reducer: mergeSteps, default: () => ({}) }),
    trouble: Annotation<unknown>(),
    founderAnswers: Annotation<ReadonlyArray<unknown>>(),
    loop: Annotation<unknown>(),
    branches: Annotation<Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>> | null>({
        reducer: mergeBranches,
        default: () => ({}),
    }),
    pin: Annotation<string>(),
    cursor: Annotation<string>(),
})

/** The options the library takes for one node: where it may end and how often it is retried. */
interface NodeOptions {
    ends: Array<string>
    retryPolicy: NodeRetryPolicy
}

/** How often the library runs a failed node again. */
interface NodeRetryPolicy {
    maxAttempts: number
}

/** What the library takes for one node: its key, its action and its options. */
type NodeEntry = [string, ReturnType<typeof actionOf>, NodeOptions]

const unsound = (node: string): never => {
    throw new LanggraphError({ code: LanggraphErrorCode.GraphUnsound, params: { node } })
}

/** Every key a node's answer may go to: its `next`, its `ends`, and the end. */
const routesOf = (node: ThreadGraphNode): ReadonlySet<string> =>
    new Set([...(node.next === undefined ? [] : [node.next]), ...(node.ends ?? []), THREAD_END])

/** The keys of the nodes a thread can come to from the entry, following every declared route. */
const reachedFrom = (graph: ThreadGraph): ReadonlySet<string> => {
    const byKey = new Map(graph.nodes.map((node) => [node.key, node]))
    const reached = new Set<string>()
    const walk = (key: string): void => {
        const node = byKey.get(key)
        if (node === undefined || reached.has(key)) return
        reached.add(key)
        for (const route of routesOf(node)) walk(route)
    }
    walk(graph.entry)
    return reached
}

/**
 * Refuses a graph the library would not compile, or would compile into something else than what was drawn, naming the first node
 * at fault: an empty, reserved or repeated key, an entry or a route to a node the graph does not have, a node no route leads to.
 */
const requireSound = (graph: ThreadGraph): void => {
    const keys = new Set<string>()
    for (const node of graph.nodes) {
        if (node.key === "" || node.key === THREAD_END || node.key === LIBRARY_START || keys.has(node.key)) unsound(node.key)
        keys.add(node.key)
    }
    if (!keys.has(graph.entry)) unsound(graph.entry)
    for (const node of graph.nodes) {
        for (const route of routesOf(node)) if (route !== THREAD_END && !keys.has(route)) unsound(node.key)
    }
    const reached = reachedFrom(graph)
    for (const node of graph.nodes) if (!reached.has(node.key)) unsound(node.key)
}

/** The thread a run belongs to, read from the run configuration the client set. */
const threadOf = (config: LangGraphRunnableConfig): ThreadRef => ({
    workspaceId: String(config.configurable?.[THREAD_CONFIG.workspace] ?? ""),
    runId: String(config.configurable?.[THREAD_CONFIG.thread] ?? ""),
})

const routeChecked = (node: ThreadGraphNode, goto: string): string => {
    if (!routesOf(node).has(goto))
        throw new LanggraphError({ code: LanggraphErrorCode.RouteUndeclared, params: { node: node.key, goto } })
    return goto
}

const branchRefused = (node: ThreadGraphNode, what: string): never => {
    throw new LanggraphError({ code: LanggraphErrorCode.BranchInvalid, params: { node: node.key, what } })
}

/**
 * The one write-and-go of a node of the SHARED state: its writes and the cursor, then the route, or a fan-out (one `Send` per branch,
 * the input of each the state as this node leaves it, with the branch's value; the cursor stays on this node while branches run).
 */
const sharedCommandOf = (
    node: ThreadGraphNode,
    values: Readonly<Record<string, unknown>>,
    answer: ThreadNodeAnswer,
    writes: Readonly<Record<string, unknown>>,
): Command => {
    if (answer.sends !== undefined) {
        const sends = answer.sends.map((one) => {
            requirePlain(one.branch, "send.branch")
            return new Send(routeChecked(node, one.node), branchInputOf(values, writes, one.branch))
        })
        return new Command({ update: { ...writes, cursor: node.key }, goto: sends })
    }
    const goto = routeChecked(node, answer.goto ?? node.next ?? THREAD_END)
    return new Command({ update: { ...writes, cursor: goto }, goto: goto === THREAD_END ? END : goto })
}

/**
 * The one write-and-go of a node of a BRANCH: only `steps` and `branches` (the channels that merge), never the cursor; the route
 * continues the branch (a `Send` carrying the branch's state with this node's steps added) or, with `join`, leaves it (a plain route:
 * the node it names runs once per superstep on the shared state). A branch never fans out again and never ends the thread.
 */
const branchCommandOf = (
    node: ThreadGraphNode,
    values: Readonly<Record<string, unknown>>,
    answer: ThreadNodeAnswer,
    writes: Readonly<Record<string, unknown>>,
    branch: unknown,
): Command => {
    const refused = branchWriteRefusedOf(writes)
    if (refused !== null) branchRefused(node, refused)
    if (answer.sends !== undefined) branchRefused(node, "sends")
    const goto = routeChecked(node, answer.goto ?? node.next ?? THREAD_END)
    if (goto === THREAD_END) branchRefused(node, THREAD_END)
    if (answer.join === true) return new Command({ update: writes, goto })
    return new Command({ update: writes, goto: new Send(goto, branchInputOf(values, writes, branch)) })
}

/**
 * One node as the library runs it: the NIVO node's run, its answer checked (a declared route, plain JSON) and turned into the one
 * write-and-go the library takes. Outside a branch the cursor is written with the route, so a checkpoint always says which node runs
 * next (the sending node while a fan-out runs). A run the library started from a `Send` reads the branch's input, not the channels.
 */
const actionOf =
    (node: ThreadGraphNode) =>
    async (values: typeof ThreadChannels.State, config: LangGraphRunnableConfig): Promise<Command> => {
        const thread = threadOf(config)
        const held = heldOf(values, thread)
        const scope: ThreadNodeScope = {
            thread,
            node: node.key,
            version: held.marks.pin,
            signal: config.signal,
            stop: (question) => {
                requirePlain(question, "stop.question")
                return interrupt({ node: node.key, question })
            },
        }
        const answer = await node.run(held.state, scope)
        const writes = writesOf(answer.update)
        const given: Readonly<Record<string, unknown>> = values
        const branch = held.state.branch ?? null
        return branch === null ? sharedCommandOf(node, given, answer, writes) : branchCommandOf(node, given, answer, writes, branch)
    }

/**
 * Compiles a NIVO thread graph into a library graph over the given saver. There are no edges but the one into the entry: every
 * node goes where its answer says. A node is tried once (`maxAttempts: 1`): a retry of a whole node is never the engine's choice,
 * the tries of a model call are counted where the model is called.
 *
 * @param graph - The graph of one workflow version.
 * @param saver - Where the checkpoints go.
 * @returns The compiled graph.
 * @throws {LanggraphError} `LANGGRAPH_GRAPH_UNSOUND` naming the node at fault.
 */
export const compiledOf = (graph: ThreadGraph, saver: BaseCheckpointSaver) => {
    requireSound(graph)
    return new StateGraph(ThreadChannels)
        .addNode(
            graph.nodes.map(
                (node): NodeEntry => [
                    node.key,
                    actionOf(node),
                    {
                        ends: [...routesOf(node)].map((route) => (route === THREAD_END ? END : route)),
                        retryPolicy: { maxAttempts: 1 },
                    },
                ],
            ),
        )
        .addEdge(START, graph.entry)
        .compile({ checkpointer: saver })
}

/** The graph the client compiles once per workflow version and runs its threads on. */
export type CompiledThreadGraph = ReturnType<typeof compiledOf>
