import type { NodeHostPorts } from "@nivo-lite/agent-sdk/node"

/**
 * The port of the LangGraph integration: everything the engine above it codes against. No type of `@langchain/*` crosses this file,
 * so a caller never imports the library and the library can be replaced behind it. Every value that enters a thread (the trigger, a
 * step's output, a trouble, a stop's question, a decision) is plain JSON: it is stored in a checkpoint and read back by another
 * process, so a class instance, a Date, a function or a bigint is refused with `LANGGRAPH_NOT_PLAIN`.
 */

/** The node key a route names to end the thread; no node of a graph may take it. */
export const THREAD_END = "__end__"

/**
 * The keys of the run configuration the client hands the checkpoint saver on every call (`config.configurable`), beside the
 * library's own `checkpoint_ns` and `checkpoint_id`. The saver reads the workspace and the fence from here, never from a state value.
 */
export const THREAD_CONFIG = {
    /** The thread: the run id. */
    thread: "thread_id",
    /** The workspace the run belongs to; every checkpoint row carries it. */
    workspace: "workspace_id",
    /** The fence number of the lease the caller drives under, or absent when the caller holds none (a read, a spec). */
    fence: "fence",
} as const

/** One thread: one run of one workflow. The run id is the thread id for the whole life of the run. */
export interface ThreadRef {
    /** The workspace the run belongs to. */
    readonly workspaceId: string
    /** The run id (`agent.run`), which is the thread id. */
    readonly runId: string
}

/**
 * What a caller drives a thread under. The library has no lock of its own: the caller holds the NIVO lease of the thread for the
 * whole call, and names its fence so the saver can refuse the writes of a driver whose lease was taken over.
 */
export interface ThreadLease {
    /** The fence number of the caller's lease; a write under an older fence than the lease row's is refused by the saver. */
    readonly fence?: number | undefined
    /** Aborts the drive (the lease was lost, the process stops); the thread stays where its last checkpoint left it. */
    readonly signal?: AbortSignal | undefined
}

/**
 * The state of a thread, plain JSON only. It holds ids and step outputs, never a conversation or a prompt (those are read through
 * the NIVO tools each time). Keys are only ever added to this shape, never renamed: a stored thread must stay readable.
 */
export interface ThreadState {
    /** What started the run, as given to `start`; never written again. */
    readonly trigger: unknown
    /** The output of each node that ran, by node key. An update adds or replaces the keys it names and keeps the others. */
    readonly steps: Readonly<Record<string, unknown>>
    /** Why the step that last ran could not complete, or null; the gate node reads it. An update replaces it. */
    readonly trouble: unknown
    /** What a person answered to the stops of this run, oldest first. An update replaces the whole list. */
    readonly founderAnswers: ReadonlyArray<unknown>
    /** The frame of the loop in progress, or null. An update replaces it. */
    readonly loop: unknown
}

/** What a node writes into the state: only the keys it names change (`steps` by node key, the others whole). */
export interface ThreadUpdate {
    /** Step outputs to add or replace, by node key. */
    readonly steps?: Readonly<Record<string, unknown>> | undefined
    /** The new trouble, or null to clear it. */
    readonly trouble?: unknown
    /** The new list of answers. */
    readonly founderAnswers?: ReadonlyArray<unknown> | undefined
    /** The new loop frame, or null to clear it. */
    readonly loop?: unknown
}

/** What `start` feeds a new thread. */
export interface ThreadStart {
    /** What started the run; it becomes `state.trigger`. */
    readonly trigger: unknown
}

/** What a node's run comes to: what it writes and where the thread goes next. */
export interface ThreadNodeAnswer {
    /** What the node writes into the state; absent writes nothing. */
    readonly update?: ThreadUpdate | undefined
    /**
     * The node that runs next, or `THREAD_END`. Absent takes the node's `next`, and ends the thread when it has none. A key the
     * node did not declare (its `next` or one of its `ends`) is refused with `LANGGRAPH_ROUTE_UNDECLARED`.
     */
    readonly goto?: string | undefined
}

/** What a node's run is handed beside the state. It is bound to one drive of one thread and is not kept past the run. */
export interface ThreadNodeScope {
    /** The thread being driven. */
    readonly thread: ThreadRef
    /** The key of the node that runs. */
    readonly node: string
    /** The version the thread is pinned to: the `version` of the graph it started on. */
    readonly version: string
    /** Aborted when the caller's lease signal is; absent when the caller gave none. */
    readonly signal?: AbortSignal | undefined
    /**
     * Stops the thread for a person and hands back what the person decided. On the first pass it does not return: it ends the node
     * there and the drive answers `stopped` with `question`. When `resume` brings a decision, **the node runs again from its first
     * line** and this call returns that decision. So a node does nothing with an effect before it calls `stop` (the gate node calls
     * it first), never calls it inside a `try` that swallows what it throws, and calls it at most once per run.
     */
    stop<Decision = unknown>(question: object): Decision
}

/**
 * The run of one node. It may run more than once for one visit (after a stop, a throw or a crash it restarts from its first line),
 * so everything it does that must not repeat goes through ports made by `replayPortsOf`, and under them through the effect ledger.
 * A throw leaves the thread at this node: the next `drive` runs it again. It is a function of the graph version, not of one run:
 * what belongs to the run arrives in `state` and `scope`.
 */
export type ThreadNodeRun = (state: ThreadState, scope: ThreadNodeScope) => Promise<ThreadNodeAnswer>

/** One node of a thread graph. */
export interface ThreadGraphNode {
    /** The key of the node, unique in its graph; never `THREAD_END`. */
    readonly key: string
    /** What the node does. */
    readonly run: ThreadNodeRun
    /** The node that follows when the answer names no `goto`; absent ends the thread. */
    readonly next?: string | undefined
    /** Every other node the answer's `goto` may name (the branches of a condition, the gate). `THREAD_END` is always allowed. */
    readonly ends?: ReadonlyArray<string> | undefined
}

/**
 * A graph as the engine hands it to the integration: built by the template compiler from one immutable workflow version. The
 * integration compiles it once per `version` per process and keeps it; a thread is pinned to the version it started on, and a
 * `resume` or `drive` with a graph of another version is refused with `LANGGRAPH_VERSION_MISMATCH` (the library itself would do
 * nothing and say nothing).
 */
export interface ThreadGraph {
    /** The id of the workflow version the graph was built from; the compile cache key and the pin of every thread started on it. */
    readonly version: string
    /** The key of the node a new thread starts at. */
    readonly entry: string
    /** The nodes, the engine's gate node included. */
    readonly nodes: ReadonlyArray<ThreadGraphNode>
}

/** A thread that waits for a person. */
export interface ThreadStop<Question = unknown> {
    /** The key of the node that stopped. */
    readonly node: string
    /** What that node handed `scope.stop`. */
    readonly question: Question
}

/**
 * How one call left the thread.
 * - `ended`: no node is left to run.
 * - `stopped`: a node called `scope.stop`; only `resume` moves the thread again (a `drive` answers `stopped` and runs nothing).
 * - `busy`: this process is already driving the thread; nothing ran. Across processes the NIVO lease is the lock, not this answer.
 * - `absent`: the thread has no checkpoint (it never started, or the process died before the first one was stored); nothing ran.
 *   The caller's own admission record (the wake, the run row) decides whether to `start` it.
 */
export type ThreadOutcome =
    | { readonly status: "ended"; readonly state: ThreadState }
    | { readonly status: "stopped"; readonly state: ThreadState; readonly stop: ThreadStop }
    | { readonly status: "busy" }
    | { readonly status: "absent" }

/** A thread as its last checkpoint shows it. */
export interface ThreadView {
    /** The version the thread is pinned to. */
    readonly version: string
    /** `stopped` waits for a person, `ended` has nothing left, `open` has a node left to run and no stop (in flight, or crashed). */
    readonly status: "open" | "stopped" | "ended"
    /** The state at the last checkpoint. */
    readonly state: ThreadState
    /** The keys of the nodes that run next; empty when ended. */
    readonly next: ReadonlyArray<string>
    /** The stop the thread waits on, or null. */
    readonly stop: ThreadStop | null
}

/** The view of a thread, or null when it has no checkpoint. */
export type OptionalThreadView = ThreadView | null

/**
 * Wraps a node host's ports for one run of a node inside a thread: `model.text`, `model.json`, `execute` and `callTool` each become
 * a recorded call, so when the node restarts the calls it already finished answer from the checkpoint and are not made again. Every
 * other port passes through (the host's own agent loop keeps its turns through `ReplayRun.record`, in the same record). The record is matched by position, so the wrapper also remembers what each call was (a model call by
 * its purpose and a digest of everything it was asked with, an effect or a tool by its call key): at the first recorded call that had failed, or that is another call than the
 * one now asked, the wrapper leaves the record and makes that call and every later one of this run of the node live. A failed call
 * is therefore always tried again, and a changed course never receives the answer of another call. A port's own error reaches the
 * node as it was thrown. Outside a node's run (the old engine, a spec of a node alone) it returns the ports unchanged.
 * A record belongs to one visit of a node: when the thread returns to the node (after the gate, in a loop) nothing is replayed.
 * It is no proof that an effect ran once: a crash between an effect and its record replays the effect. The effect ledger is.
 */
export type ReplayPortsOf = (ports: NodeHostPorts) => NodeHostPorts

/**
 * Keeps the answer of one model turn of a host's own agent loop (`NodeHostPorts.agent`) with the run of a node, the way the replay
 * wrapper keeps a model call: when the node restarts, a turn already answered is handed back and the model is not asked again. `call`
 * names the turn by its content (the loop's purpose, the turn, a digest of everything the turn sends), so a restart whose turn would
 * send other words asks the model anew; `act` asks the model and resolves to plain JSON, which is all the record keeps.
 */
export type TurnRecord = <Value>(call: string, act: () => Promise<Value>) => Promise<Value>

/**
 * The replay of ONE run of a node, for a host that has its own agent loop: `replay` wraps the host's ports (it delegates to the
 * thread's `ReplayPortsOf`), and `record` keeps the model turns of that loop in the same record, in the order they happen between
 * the node's other recorded calls. Made fresh for every run of a node; `record` before `replay` was called (or outside the run of a
 * graph node) records nothing and asks the model.
 */
export interface ReplayRun {
    /** Wraps the host's ports of this run. */
    readonly replay: ReplayPortsOf
    /** Keeps each model turn of the host's own loop with this run. */
    readonly record: TurnRecord
}

/**
 * The threads of the engine. The caller holds the NIVO lease of the thread for the whole of `start`, `resume` and `drive`; the
 * integration adds no lock across processes. A throw from a node's run rejects the call with that same error and leaves the thread
 * at the node.
 */
export interface GraphThreads {
    /**
     * Starts a thread at the graph's entry and runs it until it ends or stops. A thread that already has a checkpoint is refused
     * with `LANGGRAPH_THREAD_EXISTS` (the input is never fed twice); the caller continues it with `drive`.
     */
    start(thread: ThreadRef, graph: ThreadGraph, input: ThreadStart, lease?: ThreadLease): Promise<ThreadOutcome>
    /**
     * Hands a stopped thread the person's decision and runs it until it ends or stops again. A thread that is not stopped is
     * refused with `LANGGRAPH_THREAD_NOT_STOPPED`.
     */
    resume(thread: ThreadRef, graph: ThreadGraph, decision: object, lease?: ThreadLease): Promise<ThreadOutcome>
    /**
     * Continues a thread whose run was cut (a throw, a crash): the node that did not finish runs again, the ones before it do not.
     * On a stopped thread it runs nothing and answers `stopped`; on an ended one, `ended`.
     */
    drive(thread: ThreadRef, graph: ThreadGraph, lease?: ThreadLease): Promise<ThreadOutcome>
    /** The thread as its last checkpoint shows it, or null when it has none. It runs nothing. */
    stateOf(thread: ThreadRef): Promise<OptionalThreadView>
    /** The replay wrapper of a node host's ports; see `ReplayPortsOf`. */
    readonly replayPortsOf: ReplayPortsOf
}
