import { Annotation, Command, END, interrupt, START, StateGraph } from "@langchain/langgraph"
import type { LangGraphRunnableConfig } from "@langchain/langgraph"
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import { THREAD_CONFIG, THREAD_END } from "./langgraph.port"
import type { ThreadGraph, ThreadGraphNode, ThreadNodeScope, ThreadRef } from "./langgraph.port"
import { requirePlain } from "./plain.policy"
import { heldOf, mergeSteps, writesOf } from "./thread-state.policy"

/** The key the library starts every graph from; no node may take it. */
const LIBRARY_START: string = START

/** The channels of every thread: the five keys of the state, then the engine's pin and cursor. Only `steps` merges. */
const ThreadChannels = Annotation.Root({
    trigger: Annotation<unknown>(),
    steps: Annotation<Readonly<Record<string, unknown>>>({ reducer: mergeSteps, default: () => ({}) }),
    trouble: Annotation<unknown>(),
    founderAnswers: Annotation<ReadonlyArray<unknown>>(),
    loop: Annotation<unknown>(),
    pin: Annotation<string>(),
    cursor: Annotation<string>(),
})

/** What the library takes for one node: its key, its action and its options. */
type NodeEntry = [string, ReturnType<typeof actionOf>, { ends: string[]; retryPolicy: { maxAttempts: number } }]

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

/**
 * One node as the library runs it: the NIVO node's run, its answer checked (a declared route, plain JSON) and turned into the one
 * write-and-go the library takes. The cursor is written with the route, so a checkpoint always says which node runs next.
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
        const goto = answer.goto ?? node.next ?? THREAD_END
        if (!routesOf(node).has(goto))
            throw new LanggraphError({ code: LanggraphErrorCode.RouteUndeclared, params: { node: node.key, goto } })
        return new Command({ update: { ...writesOf(answer.update), cursor: goto }, goto: goto === THREAD_END ? END : goto })
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

/** A compiled thread graph. */
export type CompiledThreadGraph = ReturnType<typeof compiledOf>
