import { mock } from "@starci/jest-preset"
import { AGENT_NODE_EFFECTS, AGENT_RUNS, AGENT_RUN_STEPS } from "@tests/fixtures/builders/engine-core-tables.builder"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { RunStop, StopDecision } from "@modules/domain/agent-threads"
import type { AgentHandlerEnding, AgentTurnView, AgentWake } from "@modules/domain/agent-work"
import type { ThreadRef } from "@modules/integrations/langgraph"
import { eachInOrder } from "@modules/platform/primitives"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { agentTurnViewOf } from "../fixtures/builders/agent-work.builder"
import type { Act } from "./thread-world-outside"
import { WS, WorldError } from "./thread-world-records"
import { RUN_STOPS } from "./thread-world-tables"
import { CONV, FRONT, FRONT_DESK, ZALO, ZALO_USER, openedRun, seededDb, type ThreadDb, type ThreadProcess } from "./thread-world-process"
import { chatServicesOf, heard, nextTurnOf, type HeardLine, type HeardWake } from "./thread-world-intake"
import type { KeptFile } from "@modules/domain/provider-triggers/trigger-delivery.policy"

// The drivers of the phase-0 wave-C world (package 0-9): a customer writes, a founder decides, the sweep re-drives, and what the run
// page and the stops read. Threads are the only engine (phase 3): every run a wake opens is driven on a thread. The database and the processes are in `thread-world-process.ts`.

export * from "./thread-world-process"

/** A wake as a spec hands it to `turnOf`. */
type WakeDraft = Omit<AgentWake, "workspaceId">

/** A turn of a wake, under a fresh fence of the lease of its scope. */
const turnOf = (db: ThreadDb, wake: WakeDraft, overrides: Partial<AgentTurnView> = {}): AgentTurnView => {
    db.turns += 1
    db.fence += 1
    return agentTurnViewOf({
        workspaceId: WS,
        agentId: wake.agentId,
        wakeId: `wake-${db.turns}`,
        eventKey: wake.eventKey,
        source: wake.source,
        scopeKey: wake.scopeKey ?? `conversation:${wake.context.conversationId ?? CONV}`,
        context: structuredClone(wake.context),
        actorMemberId: wake.actorMemberId ?? null,
        fence: db.fence,
        turnId: `turn-${db.turns}`,
        ...overrides,
    })
}

/** How one wake ended, and the run it opened or drove. */
export interface Woken {
    /** The end of the wake, or null when it threw. */
    readonly ending: AgentHandlerEnding | null
    /** The run, or null when none was opened. */
    readonly runId: string | null
    /** What it threw, or null. */
    readonly error: unknown
}

/** Runs one turn through the real flow and says how it ended. */
const woken = async (process: ThreadProcess, turn: AgentTurnView, signal?: AbortSignal): Promise<Woken> => {
    const runOf = (): string | null =>
        [...process.db.runs.values()].find((run) => run.wakeId === turn.wakeId)?.id ?? turn.context.subjectId ?? null
    try {
        const ending = await process.flows.run(turn, signal ?? new AbortController().signal)
        return { ending, runId: runOf(), error: null }
    } catch (error) {
        return { ending: null, runId: runOf(), error }
    }
}

/** How a customer's line is driven. */
export interface WriteOptions {
    /** The signal of the drive (aborted when the lease is lost). */
    readonly signal?: AbortSignal
    /** What of the turn to change. */
    readonly turn?: Partial<AgentTurnView>
}

/** One line a customer says, as the Zalo adapter's entry gets it. */
export interface Said {
    /** The words. */
    readonly text: string
    /** Zalo's own id of the message (`msg_id`): the raw row's key and the event's id. Absent: the next one the world makes. */
    readonly key?: string
    /** The pictures the entry kept in the shop's store for it. */
    readonly files?: ReadonlyArray<KeptFile>
    /** When the customer said it (the channel's time); absent: now on the world's clock. */
    readonly at?: Date
    /** The customer's id on Zalo; absent: the world's default customer. */
    readonly userId?: string
    /** The name a body the poll made of a listed message carries (the webhook names none). */
    readonly visitor?: string
}

/** The connection (Zalo account) the world's default customer comes in on. */
const entranceOf = (db: ThreadDb): string => {
    const row = (db.store.conversation ?? []).find((one) => one.id === CONV)
    return typeof row?.connectionId === "string" ? row.connectionId : ZALO
}

/** The line the Zalo adapter's entry is handed for what a customer said. */
export const heardLineOf = (db: ThreadDb, said: Said): HeardLine => ({
    connectionId: entranceOf(db),
    userId: said.userId ?? ZALO_USER,
    msgId: said.key ?? `m-${db.chat.raw.length + 1}`,
    text: said.text,
    at: said.at ?? db.clock.now(),
    ...(said.visitor === undefined ? {} : { visitor: said.visitor }),
    ...(said.files === undefined ? {} : { files: said.files }),
})

/**
 * Customers write: each line goes through the entry's road (the body kept once as the account's event row, the provider's pure translate, the
 * REAL `deliver`: contact met, route ensured, the registration that takes it asked, one wake written), one after the other. Answers the
 * wakes the delivery wrote (none for a line the account already kept).
 */
export const customersSay = async (process: ThreadProcess, says: ReadonlyArray<Said>): Promise<ReadonlyArray<HeardWake>> => {
    const { db } = process
    await seededDb(db)
    const wakes: Array<HeardWake> = []
    for (const said of says) wakes.push(...(await heard(db, heardLineOf(db, said))))
    return wakes
}

/** Begins the run of a wake: the table marks it `begun` (the lease is taken), then the turn goes through the real flow, on a thread. */
const begun = async (process: ThreadProcess, wake: HeardWake, options: WriteOptions): Promise<Woken> => {
    wake.state = "begun"
    const ran = await woken(process, turnOf(process.db, wake, options.turn), options.signal)
    // Why the wake ended, as the table keeps it (`reason`): a hand-back re-offers the wakes a wait took.
    if (ran.ending?.reason !== null && ran.ending?.reason !== undefined) wake.reason = ran.ending.reason
    return ran
}

/**
 * Runs the turn of an intake wake through the real flow, on a thread: the oldest of the wakes still pending begins its run; the wakes a step
 * of that run takes into its queue are closed by the run's queue and begin nothing. With no wake pending, the oldest begun one is driven
 * again (a re-drive of the same wake: its run is found, the thread goes on).
 */
export const runHeard = (process: ThreadProcess, wakes: ReadonlyArray<HeardWake>, options: WriteOptions = {}): Promise<Woken> => {
    const turn = nextTurnOf(wakes) ?? wakes.find((wake) => wake.state === "begun")
    if (turn === undefined) throw new WorldError({ code: "WORLD_NO_WAKE", params: {} })
    return begun(process, turn, options)
}

/**
 * Runs every run the wakes make, as the drain does: the oldest pending wake begins a run, which may take the later pending wakes of its key
 * into its queue; whatever is still pending then begins the next run. Answers how each ended, in order.
 */
export const runTurns = async (process: ThreadProcess, wakes: ReadonlyArray<HeardWake>, options: WriteOptions = {}): Promise<ReadonlyArray<Woken>> => {
    const done: Array<Woken> = []
    for (let next = nextTurnOf(wakes); next !== undefined; next = nextTurnOf(wakes)) done.push(await begun(process, next, options))
    return done
}

/** A person hands the thread back: the REAL release door delivers ONE event of the route's channel verb (no words, `data.resume = held`) through the one delivery function. */
export const handedBack = async (process: ThreadProcess): Promise<ReadonlyArray<HeardWake>> => {
    const { db } = process
    await seededDb(db)
    const before = db.chat.wakes.length
    await chatServicesOf(db).held.answerHeld(WS, CONV)
    return db.chat.wakes.slice(before)
}

/** A customer writes in the Zalo conversation: the line goes through the real intake, then its wake is run through the REAL flow, onto a thread. */
export const customerWrites = async (process: ThreadProcess, text: string, options: WriteOptions = {}): Promise<Woken> =>
    runHeard(process, await customersSay(process, [{ text }]), options)

/** Runs the wakes the thread runs wrote from `from` on, in order, each under its own lease. */
export const drain = async (process: ThreadProcess, from = 0): Promise<ReadonlyArray<Woken>> => {
    const done: Array<Woken> = []
    await eachInOrder(process.db.wakes.slice(from), async (wake) => {
        done.push(await woken(process, turnOf(process.db, wake, { wakeId: wake.id })))
    })
    return done
}

/** A founder's decision on a stopped thread: admitted from the stores and recorded as a wake by the REAL resume requests, then run by the drain. */
export const founderDecides = async (
    process: ThreadProcess,
    runId: string,
    decision: StopDecision,
): Promise<ReadonlyArray<Woken>> => {
    const from = process.db.wakes.length
    const admitted = await process.requests.resume({ workspaceId: WS, runId }, decision)
    if (admitted.kind !== "admitted")
        throw new WorldError({ code: "WORLD_DECISION_REFUSED", params: { why: admitted.code } })
    return drain(process, from)
}

/** A re-drive of a thread (the sweep's ask), admitted and run. */
export const redrive = async (process: ThreadProcess, runId: string, key: string): Promise<ReadonlyArray<Woken>> => {
    const from = process.db.wakes.length
    const admitted = await process.threadRuns.redrive({ workspaceId: WS, runId }, key)
    if (admitted.kind !== "admitted")
        throw new WorldError({ code: "WORLD_REDRIVE_REFUSED", params: { why: admitted.code } })
    return drain(process, from)
}

/** The answer of a founder in words. */
export const answer = (db: ThreadDb, text: string): StopDecision => ({
    kind: "answer",
    text,
    by: "owner-1",
    at: db.clock.now().toISOString(),
})

/** A button of a founder. */
export const button = (db: ThreadDb, kind: "retry" | "take_over" | "skip"): StopDecision => ({
    kind,
    by: "owner-1",
    at: db.clock.now().toISOString(),
})

/** The stops of a run, as the real stops read them, by the step keys the records hold. */
export const stopsOf = async (process: ThreadProcess, runId: string): Promise<ReadonlyArray<RunStop>> => {
    const keys = process.db.records.of(RUN_STOPS, { runId }).map((row) => String(row.data.stepKey))
    const stops = await Promise.all(keys.map((stepKey) => process.stops.stopOf({ workspaceId: WS, runId }, stepKey)))
    return stops.flatMap((stop) => (stop === null ? [] : [stop]))
}

/** The run row and its step rows, as the run page reads them. */
export interface RunRows {
    /** The run row's data, or null. */
    readonly run: RecordRow["data"] | null
    /** The step rows' data, by ordinal. */
    readonly steps: ReadonlyArray<RecordRow["data"]>
}

/** The rows of a run. */
export const rowsOf = (db: ThreadDb, runId: string): RunRows => ({
    run: db.records.get(AGENT_RUNS, runId)?.data ?? null,
    steps: db.records
        .of(AGENT_RUN_STEPS, { runId })
        .map((row) => row.data)
        .toSorted((left, right) => Number(left.ordinal) - Number(right.ordinal)),
})

/** The acts of one effect. */
export const actsOf = (db: ThreadDb, effect: string): ReadonlyArray<Act> =>
    db.acts.filter((act) => act.effect === effect)

/** The ledger rows of the effects. */
export const ledgerOf = (db: ThreadDb): ReadonlyArray<RecordRow["data"]> =>
    db.records.of(AGENT_NODE_EFFECTS).map((row) => row.data)

/** What a direct start is given: a graph of the spec's choosing and a trigger (a run with no customer, a template variant). */
export interface DirectStart {
    /** The graph. */
    readonly flow: GraphSpec
    /** Its version id (`<agent>:<workflow>@<n>`). */
    readonly versionId: string
    /** The trigger the nodes read. */
    readonly trigger: Readonly<Record<string, unknown>>
    /** The lock scope of the run; absent takes a scope of its own. */
    readonly scopeKey?: string
    /** The workflow the run is pinned to (its steps read their node's declared mode through it); absent: none (an agent's own graph). */
    readonly workflowId?: string
}

/** Opens a run of the front desk and starts its thread straight through the REAL thread runs: what the flow would hand them, minus routing. */
export const startThread = async (process: ThreadProcess, start: DirectStart): Promise<Woken> => {
    const { db } = process
    db.versions.set(start.versionId, { number: Number(start.versionId.split("@").at(-1) ?? 1), flow: start.flow })
    const scopeKey = start.scopeKey ?? `run-scope:${db.turns + 1}`
    const turn = turnOf(db, {
        agentId: FRONT,
        source: "tag",
        eventKey: `direct-${db.turns + 1}`,
        scopeKey,
        context: {},
        actorMemberId: null,
    })
    const run = openedRun(db, {
        workspaceId: WS,
        agentId: FRONT,
        wakeId: turn.wakeId,
        trigger: "graph_flow",
        versionId: start.versionId,
        context: { threadScope: scopeKey },
    })
    await process.threadRuns.opened(mock(), WS, run.id)
    // A run of a workflow is pinned to it as the flow pins it (`AgentWorkflowRunsService.pinRun`): a resumed or re-driven step reads its
    // node's declared mode through that pin, exactly as in the engine.
    if (start.workflowId !== undefined && !db.workflows.pins.has(run.id))
        db.workflows.pins.set(run.id, {
            runId: run.id,
            workflowId: start.workflowId,
            workflowVersionId: start.versionId,
            workflowVersion: Number(start.versionId.split("@").at(-1) ?? 1),
        })
    const thread = {
        turn,
        runId: run.id,
        versionId: start.versionId,
        flow: start.flow,
        namespace: FRONT_DESK,
        workflowId: start.workflowId ?? null,
        workflowVersion: start.workflowId === undefined ? null : Number(start.versionId.split("@").at(-1) ?? 1),
        trigger: start.trigger,
    }
    try {
        return {
            ending: await process.threadRuns.started(thread, new AbortController().signal),
            runId: run.id,
            error: null,
        }
    } catch (error) {
        return { ending: null, runId: run.id, error }
    }
}

/** The ref of a run's thread. */
export const refOf = (runId: string): ThreadRef => ({ workspaceId: WS, runId })
