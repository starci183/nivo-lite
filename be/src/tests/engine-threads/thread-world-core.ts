import type { Provider } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphFreezeGateService, AgentGraphTurnPolicyService } from "@modules/domain/agent-graphs"
import { AgentGraphRunQueueService } from "@modules/domain/agent-graphs/agent-graph-run-queue.service"
import { RunStopRecordsService } from "@modules/domain/agent-threads"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
import { CONTACT_FREEZE_STORE, LeadFreezeRecordsService, LeadFreezeWakesService, LeadFreezesService } from "@modules/domain/lead-freezes"
import { LeadFreezeStopHoldsService } from "@modules/domain/lead-freezes/lead-freeze-stop-holds.service"
import { LeadFreezeStopsService } from "@modules/domain/lead-freezes/lead-freeze-stops.service"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { chatServicesOf } from "./thread-world-intake"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { MONEY_MOVE, NOTE_WRITE } from "../fixtures/builders/engine-core-plugin.builder"
import { WorldError } from "./thread-world-records"
import { CONTACT_FREEZES, worldFreezeStore } from "./thread-world-tables"
import { memoryEffectStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import {
    processOf,
    refOf,
    startThread,
    type ProcessOptions,
    type ThreadDb,
    type ThreadProcess,
} from "./thread-world"

// THE ENGINE CORE WORLD'S PARTS (worker E): what the generic worlds of the engine core (`engine-core-*.spec.ts`) share over the generic
// fixture plugin (`engine-core-plugin.builder.ts`): its graphs as installed, the executors of its two test writes (each act kept in the
// database's `acts`, a fault of `throwOn` thrown once), a process with them, and a direct start of one of its graphs.

/** One act of a test write: what reached the outside world, under which call key, on which account, approved by whom. */
export interface NoteAct {
    /** The tool the act reached the outside world through. */
    readonly effect: string
    /** What the act sent. */
    readonly payload: EffectPayload
    /** The call key the act ran under. */
    readonly key: string
    /** The account the act was made on; null when it used none. */
    readonly connectionId: string | null
    /** Who approved the act; null when nobody had to. */
    readonly approvedBy: string | null
    /** The workspace the act ran in. */
    readonly workspaceId: string
}

/** The acts of the test writes, per database (outlives a process, as the database does). */
const noteActs = new WeakMap<ThreadDb, Array<NoteAct>>()

/** The acts of the test writes over a database, in order. */
export const noteActsOf = (db: ThreadDb): Array<NoteAct> => {
    const kept = noteActs.get(db) ?? []
    noteActs.set(db, kept)
    return kept
}

/** The executor of one test write: keeps the act, throws the database's fault for it once, else answers a note record. */
const noteExecutorOf = (db: ThreadDb, effect: string): NodeEffectExecutor => ({
    effect,
    execute: (turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> => {
        const acts = noteActsOf(db)
        acts.push({
            effect,
            payload: structuredClone(payload),
            key: call.key,
            connectionId: turn.account?.connectionId ?? null,
            approvedBy: turn.approvedBy ?? null,
            workspaceId: turn.workspaceId,
        })
        const fault = db.throwOn.get(effect)
        if (fault !== undefined) {
            db.throwOn.delete(effect)
            return Promise.reject(fault)
        }
        return Promise.resolve({ kind: "note", id: `note-${acts.length}`, facts: { noteId: String(payload.noteId) } })
    },
})

/** The executors of the fixture's two test writes. */
export const noteExecutorsOf = (db: ThreadDb): ReadonlyArray<NodeEffectExecutor> => [
    noteExecutorOf(db, NOTE_WRITE),
    noteExecutorOf(db, MONEY_MOVE),
]

/** A process over the database with the fixture's executors (the world's real door, runner and ledger unless `options` says else). */
export const coreProcessOf = (db: ThreadDb, options: ProcessOptions = {}): Promise<ThreadProcess> =>
    processOf(db, { ...options, executors: [...noteExecutorsOf(db), ...(options.executors ?? [])] })

/** The graph a fixture graph is installed as: the one version of its workflow template. */
export const coreFlowOf = (id: string): GraphSpec => {
    const graph = INSTALLED.templateOf(id)?.versions[0]?.graph
    if (graph === undefined) throw new WorldError({ code: "WORLD_TEMPLATE_MISSING", params: { id } })
    return graph
}

/** What every fixture graph is started with. */
export const NOTE_TRIGGER = { noteId: "note-1", text: "goi lai cho khach", locale: "vi" }

/** The workflow a fixture graph's run is pinned to (every graph run is a workflow's: its steps read their node's mode through it). */
export const workflowIdOf = (id: string): string => `wf:${id}`

/** Starts a fixture graph on a thread of the process; answers the run id (the start must not throw). */
export const coreStarted = async (
    process: ThreadProcess,
    id: string,
    trigger: Readonly<Record<string, unknown>> = NOTE_TRIGGER,
    version = 1,
): Promise<string> => {
    const woken = await startThread(process, { flow: coreFlowOf(id), versionId: `${id}@${version}`, trigger, workflowId: workflowIdOf(id) })
    if (woken.error !== null) throw woken.error
    return woken.runId ?? ""
}

/** The thread state of a run: its status and its steps. */
export const threadOf = async (process: ThreadProcess, runId: string) => {
    const state = await process.threads.stateOf(refOf(runId))
    return { status: state?.status ?? null, steps: state?.state.steps ?? {} }
}

/**
 * The providers that give a process the engine's HOLD of a subject while a stop of a thread run about it stands open (the REAL
 * lead-freezes services, as their module composes them, with the freeze gate the flow asks before any run opens): the only mechanism the
 * engine has for "a second event of a subject whose run waits at a stop". The freezes live in the world's freezes table (`thread-world-tables.ts`), whose one unique key
 * (the subject's) makes a second freeze of a subject find the first, as the table does.
 */
export const holdProvidersOf = (db: ThreadDb): ReadonlyArray<Provider> => {
    return [
        joinedPolicyOf(db),
        // The run queue the app provides (`agent-graphs.module.ts`): without it `run.queue` is always empty and a held event is never taken.
        AgentGraphRunQueueService,
        AgentGraphFreezeGateService,
        { provide: CONTACT_FREEZE_STORE, useValue: worldFreezeStore(db.records) },
        LeadFreezeRecordsService,
        LeadFreezeStopsService,
        LeadFreezeStopHoldsService,
        LeadFreezeWakesService,
        LeadFreezesService,
        // The routes' staff hold the app's global capability serves (`CustomerRoutesModule`): the resume door ends a take-over's hold
        // with the decision that closes the stop (R52), and a step reads it; the same service the world's doors hold and release with.
        { provide: CustomerRoutesService, useValue: chatServicesOf(db).routes },
    ]
}

/**
 * The REAL turn policy (`AgentGraphTurnPolicyService`, which the app's agent-graphs module provides to every step) over the world's
 * database: what a step is told of its run, the events that JOINED the run while it waited at a stop (`ctx.run.joined`) among it. The effect
 * ledger, the stops and the holds are the REAL ledger store double, stop and freeze doors over the world's tables.
 */
const joinedPolicyOf = (db: ThreadDb): Provider => {
    return {
        provide: AgentGraphTurnPolicyService,
        // The run's queue (`ctx.run.queue`) is the REAL queue service: its snapshot per step visit is written in the world's effect ledger.
        useFactory: (stops: RunStopRecordsService, queue?: AgentGraphRunQueueService) =>
            new AgentGraphTurnPolicyService(db.clock, undefined, undefined, stops, memoryEffectStore(db.records), chatServicesOf(db).deliveries, queue),
        inject: [RunStopRecordsService, { token: AgentGraphRunQueueService, optional: true }],
    }
}

/** The holds the world keeps, as rows. */
export const holdsOf = (db: ThreadDb): ReadonlyArray<Readonly<Record<string, unknown>>> =>
    db.records.of(CONTACT_FREEZES).map((row) => row.data)
