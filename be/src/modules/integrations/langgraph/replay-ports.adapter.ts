import { getConfig, task } from "@langchain/langgraph"
import type { NodeHostPorts, NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { digestOf } from "./asked-digest.policy"
import { THREAD_CONFIG, type OptionalTurnRecord, type ReplayPortsOf, type ReplayRun, type TurnRecord } from "./langgraph.port"

/** The name every recorded call is stored under; the library tells calls apart by their position in the node, not by this name. */
const RECORD_NAME = "nivo.call"

/** The key of the run configuration under which the library hands a running node its call recorder; `task` needs it. */
const NODE_CALL_KEY = "__pregel_call"

/**
 * What tells one model call from another: everything it was asked with (instructions, the words of this call, the input, pictures,
 * effort), as a digest. Two calls with the same purpose and other content (a founder's answer, a new customer line) are two calls.
 */
const askedOf = (request: NodeModelRequest): string => digestOf(request)

/** The turn record of one run of a node, once its ports were wrapped. */
interface HeldRecord {
    /** The record, or null before the wrap (or outside the run of a node). */
    record: OptionalTurnRecord
}

/** The record of the host's own agent turns that belongs to each set of ports the wrapper made, in the same record as their calls. */
const turnRecords = new WeakMap<NodeHostPorts, TurnRecord>()

/** One finished call as the checkpoint keeps it: what was asked (`call`) and, when it answered, the answer. A failure keeps no words. */
type Recorded<Value> =
    | { readonly call: string; readonly ok: true; readonly value: Value }
    | { readonly call: string; readonly ok: false }

/** What the body of one recorded call left behind in this process; it stays untouched when the answer came from the checkpoint. */
interface Pass {
    /** True once the body ran here: the answer is live, not replayed. */
    ran: boolean
    /** True when the port threw. */
    failed: boolean
    /** What the port threw, as it threw it. */
    cause: unknown
}

/** Told when a restarted node leaves its record (`thread` is the run id, `position` counts the calls from 0): the rest of that run is made live. */
export type ReplayLeft = (thread: string, position: number, why: "failed-before" | "asks-another") => void

/** The id of the thread whose node is running, or null outside the run of a graph node (only there can the library record a call). */
const runningThread = (): string | null => {
    const configurable: unknown = getConfig()?.configurable
    if (typeof configurable !== "object" || configurable === null) return null
    if (typeof Reflect.get(configurable, NODE_CALL_KEY) !== "function") return null
    return String(Reflect.get(configurable, THREAD_CONFIG.thread) ?? "")
}

/**
 * The replay wrapper of a node host's ports (`ReplayPortsOf` of the port file). Inside a node's run, `model.text`, `model.json`,
 * `execute` and `callTool` each become one recorded call; every other port (`read`, `write`, `now`, a host's own agent loop) passes
 * through as it is. Outside a node's run it returns the ports as they are.
 *
 * When the node restarts (after a stop, a throw or a crash) the library hands back the recorded answers by position. The wrapper
 * returns one only when it is the answer of the same call and that call had answered. A model call is the same call only when it
 * is asked with the same content (purpose and a digest of the whole request): a restart that carries a founder's answer or a new
 * customer line asks the model again. An effect or a tool is the same call by its call key (the step and a digest of its arguments). At the first recorded call that failed or that is another call, the wrapper leaves the record: that call
 * and every later one of this run of the node are made live and are not recorded. So a call that failed is always tried again
 * (an approval that arrived, a provider that is back), a changed course never receives the answer of another call, and what keeps
 * an effect from happening twice from there on is the effect ledger under the ports, as it is for every live call.
 *
 * The record belongs to one visit of a node. When the thread comes back to the node later (the gate sent it back after a decision,
 * a loop came round) nothing of the earlier visit is replayed: every call is made, and an effect asked again under the same key is
 * answered by the ledger.
 *
 * A recorded body never throws into the library (a throw there would end the whole drive even when the node catches it): the
 * failure is kept as a mark and the port's own error is rethrown to the node unchanged, class and all.
 *
 * @param ports - The host's ports of one run of a node.
 * @param left - Told when a restart leaves its record; absent tells nobody.
 * @returns The wrapped ports, or `ports` itself outside a node's run.
 */
export const replayPortsOf = (ports: NodeHostPorts, left?: ReplayLeft): NodeHostPorts => {
    const thread = runningThread()
    if (thread === null) return ports
    const state = { live: false, position: 0 }
    const recorded = async <Value>(call: string, act: () => Promise<Value>): Promise<Value> => {
        if (state.live) return act()
        const position = state.position
        state.position += 1
        const pass: Pass = { ran: false, failed: false, cause: null }
        const body = async (): Promise<Recorded<Value>> => {
            pass.ran = true
            try {
                return { call, ok: true, value: await act() }
            } catch (cause) {
                pass.failed = true
                pass.cause = cause
                return { call, ok: false }
            }
        }
        const kept = await task(RECORD_NAME, body)()
        if (pass.failed) throw pass.cause
        if (kept.ok && (pass.ran || kept.call === call)) return kept.value
        state.live = true
        left?.(thread, position, kept.ok ? "asks-another" : "failed-before")
        return act()
    }
    const wrapped: NodeHostPorts = {
        ...ports,
        execute: (effect, payload, call) =>
            recorded(`execute:${effect.id}:${call.key}`, () => ports.execute(effect, payload, call)),
        callTool: (tool, args, key) => recorded(`tool:${tool.id}:${key}`, () => ports.callTool(tool, args, key)),
        model: {
            text: (request) => recorded(`model.text:${request.purpose}:${askedOf(request)}`, () => ports.model.text(request)),
            json: (schema, request) => recorded(`model.json:${request.purpose}:${askedOf(request)}`, () => ports.model.json(schema, request)),
        },
    }
    // The host's own agent loop is not a port this wrapper can reach into: its turns are kept through `turnRecordOf`, by the same
    // record (one position counter, one "live from here" mark), so a turn and the door calls it led to replay in the order they ran.
    turnRecords.set(wrapped, (call, act) => recorded(`agent.turn:${call}`, act))
    return wrapped
}

/**
 * The record of the model turns of a host's own agent loop that belongs to ports `replayPortsOf` made, or null for any other ports
 * (outside the run of a graph node the wrapper hands the ports back as they are, and nothing can be recorded). A turn is one recorded
 * call like a model call of the ports: replayed by position when the node restarts and the turn is the same (its `call` names its
 * content), else made live with everything after it. What it keeps is what `act` resolved to: the plain answer of the turn, never the
 * transcript (the loop rebuilds every message from those answers and the facts of the recorded door calls).
 *
 * @param ports - Ports the wrapper made.
 * @returns The turn record, or null.
 */
export const turnRecordOf = (ports: NodeHostPorts): OptionalTurnRecord => turnRecords.get(ports) ?? null

/**
 * The replay of one run of a node with its agent turns: `replay` delegates to the thread's wrapper and keeps the turn record of the
 * ports it made; `record` keeps each model turn in that record. Made fresh for every run of a node (the record belongs to one run).
 *
 * @param replay - The thread's replay wrapper (`GraphThreads.replayPortsOf`).
 * @returns The pair the node host is handed as `replay` and `record`.
 */
export const replayRunOf = (replay: ReplayPortsOf): ReplayRun => {
    const held: HeldRecord = { record: null }
    return {
        replay: (ports) => {
            const wrapped = replay(ports)
            held.record = turnRecordOf(wrapped)
            return wrapped
        },
        record: (call, act) => (held.record === null ? act() : held.record(call, act)),
    }
}
