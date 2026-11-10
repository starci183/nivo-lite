import { mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { StepJson, StepSpec } from "@modules/domain/agent-runs"
import type { RunStop, StopDecision } from "@modules/domain/agent-threads"
import type { AgentHandlerEnding, AgentTurnView, AgentWake } from "@modules/domain/agent-work"
import type { ThreadRef } from "@modules/integrations/langgraph"
import { eachInOrder } from "@modules/platform/primitives"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { stepViewOf } from "../fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "../fixtures/builders/agent-work.builder"
import type { Act } from "./thread-world-outside"
import { WS, WorldError } from "./thread-world-records"
import { CONV, FRONT, FRONT_DESK, openedRun, type ThreadDb, type ThreadProcess } from "./thread-world-process"

// The drivers of the phase-0 wave-C world (package 0-9): a customer writes, a founder decides, the sweep re-drives, the old engine plays
// a run, and what the run page and the stops read. The database and the processes are in `thread-world-process.ts`.

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
        scopeKey: wake.scopeKey ?? `conversation:${CONV}`,
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

/** A customer writes in the Zalo conversation: the wake goes through the REAL flow (the flag decides the engine). */
export const customerWrites = (process: ThreadProcess, text: string, options: WriteOptions = {}): Promise<Woken> => {
    const { db } = process
    const inbox = db.store.inbox ?? []
    const id = `msg-${inbox.length + 1}`
    const at = db.clock.now().toISOString()
    inbox.push({ id, body: text, at })
    db.store.message?.push({ id: `in-${id}`, conversationId: CONV, role: "user", text, sentAt: at, status: "posted" })
    const context = { conversationId: CONV, messageId: id, channelEventId: `zalo:${id}`, lookupName: false }
    const turn = turnOf(
        db,
        { agentId: FRONT, source: "customer", eventKey: id, context, actorMemberId: null },
        options.turn,
    )
    return woken(process, turn, options.signal)
}

/** Runs the wakes the thread runs wrote from `from` on, in order, each under its own lease. */
export const drain = async (process: ThreadProcess, from = 0): Promise<ReadonlyArray<Woken>> => {
    const done: Array<Woken> = []
    await eachInOrder(process.db.wakes.slice(from), async (wake) => {
        done.push(await woken(process, turnOf(process.db, wake, { wakeId: wake.id })))
    })
    return done
}

/** A founder's decision on a stopped thread: admitted as a wake by the REAL thread runs, then run by the drain. */
export const founderDecides = async (
    process: ThreadProcess,
    runId: string,
    decision: StopDecision,
): Promise<ReadonlyArray<Woken>> => {
    const from = process.db.wakes.length
    const admitted = await process.threadRuns.resume({ workspaceId: WS, runId }, decision)
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

/** What the old engine did with a run. */
export interface OldPlay {
    /** The steps done, in order. */
    readonly path: ReadonlyArray<string>
    /** The output of each step. */
    readonly outputs: Readonly<Record<string, unknown>>
}

/** The old engine's steps of a run, played one after the other as the step handler would, from the first the flow wrote. */
export const playOld = async (process: ThreadProcess, runId: string): Promise<OldPlay> => {
    const path: Array<string> = []
    const earlier: Record<string, StepJson> = {}
    const agentId = process.db.runs.get(runId)?.agentId ?? FRONT
    const play = async (queue: ReadonlyArray<StepSpec>): Promise<void> => {
        const [spec, ...rest] = queue
        if (spec === undefined) return
        const view = stepViewOf({ ...spec, runId, agentId, workspaceId: WS, earlier: { ...earlier }, result: null })
        const answered = await process.oldSteps.run(view)
        if (answered.kind !== "done")
            throw new WorldError({ code: "WORLD_OLD_STEP", params: { step: spec.stepKey, kind: answered.kind } })
        path.push(spec.stepKey)
        earlier[spec.stepKey] = answered.result
        await play([...rest, ...answered.next])
    }
    await play(process.db.appended.get(runId) ?? [])
    return {
        path,
        outputs: Object.fromEntries(Object.entries(earlier).map(([key, result]) => [key, result.output ?? null])),
    }
}

/** The stops of a run, as the real stops read them, by the step keys the records hold. */
export const stopsOf = async (process: ThreadProcess, runId: string): Promise<ReadonlyArray<RunStop>> => {
    const keys = process.db.records.of("agent.run-stop", { runId }).map((row) => String(row.data.stepKey))
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
    run: db.records.get("agent.run", runId)?.data ?? null,
    steps: db.records
        .of("agent.run-step", { runId })
        .map((row) => row.data)
        .toSorted((left, right) => Number(left.ordinal) - Number(right.ordinal)),
})

/** The acts of one effect. */
export const actsOf = (db: ThreadDb, effect: string): ReadonlyArray<Act> =>
    db.acts.filter((act) => act.effect === effect)

/** The ledger rows of the effects. */
export const ledgerOf = (db: ThreadDb): ReadonlyArray<RecordRow["data"]> =>
    db.records.of("agent.node-effect").map((row) => row.data)

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
    const thread = {
        turn,
        runId: run.id,
        versionId: start.versionId,
        flow: start.flow,
        namespace: FRONT_DESK,
        workflowId: null,
        workflowVersion: null,
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
