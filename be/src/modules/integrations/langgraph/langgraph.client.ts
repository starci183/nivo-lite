import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph"
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import { InjectGraphCheckpoints, InjectLanggraphOptions } from "./langgraph.decorators"
import { LanggraphLogEvent } from "./langgraph.log-events"
import type { LanggraphOptions } from "./langgraph.options"
import { THREAD_CONFIG, THREAD_END } from "./langgraph.port"
import type {
    GraphThreads,
    OptionalThreadView,
    ReplayPortsOf,
    ThreadGraph,
    ThreadLease,
    ThreadOutcome,
    ThreadRef,
    ThreadStart,
    ThreadView,
} from "./langgraph.port"
import { requirePlain } from "./plain.policy"
import { replayPortsOf } from "./replay-ports.adapter"
import { compiledOf } from "./thread-graph.adapter"
import type { CompiledThreadGraph } from "./thread-graph.adapter"
import { heldOf, openingOf, stopOf } from "./thread-state.policy"

/** The channel under which the library keeps a decision handed to a stopped thread until the node that asked has finished. */
const RESUME_CHANNEL = "__resume__"

/** What one run of the library is fed: the opening values, a decision, or nothing (continue). */
type ThreadFeed = Readonly<Record<string, unknown>> | Command | null

/**
 * The threads of the engine on LangGraph, and the only place that drives the library. What the library does not do, this client
 * does, because each was seen to go wrong without it:
 *
 * - **No lock.** The library runs two calls on one thread at once. Here a second call on a thread this process already drives
 *   answers `busy` and runs nothing. Across processes the caller's lease is the lock and the saver's fence the last word.
 * - **A changed graph.** Resuming on a graph whose node was renamed does nothing and says nothing. Here a thread carries the
 *   version it started on (`pin`), and a `resume` or `drive` with another version is refused by name.
 * - **Nothing stored yet.** Continuing a thread with no checkpoint raises an error of the library. Here it answers `absent`, and
 *   `start` on a thread that has one is refused, so an input is never fed twice.
 *
 * It keeps two things in memory, both rebuilt from nothing after a restart: the compiled graphs, one per workflow version (a
 * version never changes, so an entry is never stale; the one used longest ago leaves when `compiledMax` is passed), and the set of
 * threads being driven right now. Every run asks the library for its strictest durability; that still leaves a window in which a
 * finished call is not stored yet, which is why the effect ledger stays under the ports.
 */
@Injectable()
export class LanggraphClient implements GraphThreads {
    private readonly compiled = new Map<string, CompiledThreadGraph>()

    private readonly driving = new Set<string>()

    constructor(
        @InjectGraphCheckpoints() private readonly saver: BaseCheckpointSaver,
        @InjectLanggraphOptions() private readonly options: LanggraphOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The replay wrapper of a node host's ports; a restart that leaves its record is logged by position, never by content. */
    readonly replayPortsOf: ReplayPortsOf = (ports) =>
        replayPortsOf(ports, (thread, position, why) => {
            this.logger.warn(LanggraphLogEvent.ReplayLeft, { thread, position, why })
        })

    /** Starts a thread at the graph's entry; a thread that has a checkpoint is refused. */
    start(thread: ThreadRef, graph: ThreadGraph, input: ThreadStart, lease?: ThreadLease): Promise<ThreadOutcome> {
        return this.alone(thread, "start", async () => {
            if ((await this.viewOf(thread)) !== null)
                throw new LanggraphError({ code: LanggraphErrorCode.ThreadExists, params: { thread: thread.runId } })
            const compiled = this.compiledFor(graph)
            return this.run(thread, compiled, openingOf(input, { pin: graph.version, cursor: graph.entry }), lease)
        })
    }

    /** Hands a stopped thread the decision; a thread that is not stopped is refused. */
    resume(thread: ThreadRef, graph: ThreadGraph, decision: object, lease?: ThreadLease): Promise<ThreadOutcome> {
        return this.alone(thread, "resume", async () => {
            const view = await this.viewOf(thread)
            if (view === null) return { status: "absent" }
            this.requirePinned(view, graph)
            if (view.status !== "stopped")
                throw new LanggraphError({ code: LanggraphErrorCode.ThreadNotStopped, params: { thread: thread.runId } })
            requirePlain(decision, "resume.decision")
            return this.run(thread, this.compiledFor(graph), new Command({ resume: decision }), lease)
        })
    }

    /** Continues a thread whose run was cut; a stopped or an ended one is answered as it is and nothing runs. */
    drive(thread: ThreadRef, graph: ThreadGraph, lease?: ThreadLease): Promise<ThreadOutcome> {
        return this.alone(thread, "drive", async () => {
            const view = await this.viewOf(thread)
            if (view === null) return { status: "absent" }
            this.requirePinned(view, graph)
            if (view.stop !== null) return { status: "stopped", state: view.state, stop: view.stop }
            if (view.status === "ended") return { status: "ended", state: view.state }
            return this.run(thread, this.compiledFor(graph), null, lease)
        })
    }

    /** The thread as its last checkpoint shows it, or null when it has none. */
    stateOf(thread: ThreadRef): Promise<OptionalThreadView> {
        return this.viewOf(thread)
    }

    /** Runs `act` unless this process already drives the thread, in which case nothing runs and the answer is `busy`. */
    private async alone(thread: ThreadRef, call: string, act: () => Promise<ThreadOutcome>): Promise<ThreadOutcome> {
        const key = `${thread.workspaceId}:${thread.runId}`
        if (this.driving.has(key)) {
            this.logger.warn(LanggraphLogEvent.ThreadBusy, { thread: thread.runId, call })
            return { status: "busy" }
        }
        this.driving.add(key)
        try {
            return await act()
        } finally {
            this.driving.delete(key)
        }
    }

    /** Refuses a graph of another version than the one the thread started on. */
    private requirePinned(view: ThreadView, graph: ThreadGraph): void {
        if (view.version !== graph.version)
            throw new LanggraphError({
                code: LanggraphErrorCode.VersionMismatch,
                params: { pinned: view.version, given: graph.version },
            })
    }

    /** The address of a thread's checkpoints, with the fence of the caller's lease when it named one. */
    private configurableOf(thread: ThreadRef, lease?: ThreadLease): Readonly<Record<string, unknown>> {
        return {
            [THREAD_CONFIG.thread]: thread.runId,
            [THREAD_CONFIG.workspace]: thread.workspaceId,
            ...(lease?.fence === undefined ? {} : { [THREAD_CONFIG.fence]: lease.fence }),
        }
    }

    /** Reads the last checkpoint of a thread. A stop counts until a decision for it is stored; then the thread is open again. */
    private async viewOf(thread: ThreadRef): Promise<OptionalThreadView> {
        const tuple = await this.saver.getTuple({ configurable: this.configurableOf(thread) })
        if (tuple === undefined) return null
        const { state, marks } = heldOf(tuple.checkpoint.channel_values, thread)
        const writes = tuple.pendingWrites ?? []
        const answered = writes.some(([, channel]) => channel === RESUME_CHANNEL)
        const asked = writes.find(([, channel]) => channel === INTERRUPT)
        const stop = asked === undefined || answered ? null : stopOf(asked[2])
        const ended = marks.cursor === THREAD_END
        const moving = ended ? "ended" : "open"
        return {
            version: marks.pin,
            status: stop === null ? moving : "stopped",
            state,
            next: ended ? [] : [marks.cursor],
            stop,
        }
    }

    /** The compiled graph of a version: compiled on first use, kept, and moved to the young end of the cache on each use. */
    private compiledFor(graph: ThreadGraph): CompiledThreadGraph {
        const kept = this.compiled.get(graph.version)
        if (kept !== undefined) {
            this.compiled.delete(graph.version)
            this.compiled.set(graph.version, kept)
            return kept
        }
        const fresh = compiledOf(graph, this.saver)
        this.compiled.set(graph.version, fresh)
        const oldest = this.compiled.keys().next()
        if (this.compiled.size > this.options.compiledMax && oldest.done !== true) this.compiled.delete(oldest.value)
        this.logger.info(LanggraphLogEvent.GraphCompiled, {
            version: graph.version,
            nodes: graph.nodes.length,
            kept: this.compiled.size,
        })
        return fresh
    }

    /** One run of the library on a thread, until it ends or a node stops it. No tracer and no callback is ever handed over. */
    private async run(
        thread: ThreadRef,
        compiled: CompiledThreadGraph,
        feed: ThreadFeed,
        lease?: ThreadLease,
    ): Promise<ThreadOutcome> {
        const result: unknown = await compiled.invoke(feed, {
            configurable: this.configurableOf(thread, lease),
            durability: "sync",
            recursionLimit: this.options.stepLimit,
            callbacks: [],
            ...(lease?.signal === undefined ? {} : { signal: lease.signal }),
        })
        const { state } = heldOf(result, thread)
        const stop = isInterrupted(result) ? stopOf(result[INTERRUPT]) : null
        return stop === null ? { status: "ended", state } : { status: "stopped", state, stop }
    }
}
