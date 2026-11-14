import { Inject, Injectable, Optional } from "@nestjs/common"
import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { EntityManager } from "typeorm"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { PendingScopeWake } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { NODE_EFFECT_STORE, type NodeEffectStore, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"
import type { StepPlace } from "./policies/turn-policy.policy"
import { pipelineVerbOf } from "./policies/workflow-trigger.policy"

/** The member of a run's context that keeps the lock scope its wake ran under (`THREAD_SCOPE_MEMBER` of the flow runs). */
const THREAD_SCOPE = "threadScope"

/** The most queued events one step visit takes. */
const QUEUE_TAKE_MAX = 50

/** The effect a queue snapshot is kept under in the effect ledger: one row per step visit, written once. */
const QUEUE_EFFECT = "engine.run.queue"

/** The ledger key of a step visit's queue snapshot. */
const snapshotKeyOf = (runId: string, stepKey: string, visit: number): string => `queue:${runId}:${stepKey}:${visit}`

/** One queued event as the snapshot keeps it: the wake it came on and the scope its step reads. */
interface QueuedEvent {
    readonly wakeId: string
    readonly scope: JsonObject
}

/** A JSON object copied from a plain record (what the ledger and a node may hold); a value that is no JSON is left out. */
const jsonObjectOf = (value: Readonly<Record<string, unknown>>): JsonObject => {
    const copied: unknown = JSON.parse(JSON.stringify(value))
    return isRecord(copied) ? Object.fromEntries(Object.entries(copied).map(([name, member]) => [name, jsonValueOf(member)])) : {}
}

/** A value parsed back from JSON text, typed as JSON (it came from `JSON.parse`, so it is one). */
const jsonValueOf = (value: unknown): JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
    if (Array.isArray(value)) return value.map((member: unknown) => jsonValueOf(member))
    return isRecord(value) ? Object.fromEntries(Object.entries(value).map(([name, member]) => [name, jsonValueOf(member)])) : null
}

/** The events a snapshot row keeps, oldest first; none for a row that holds none. */
const eventsOf = (args: Readonly<Record<string, unknown>> | null): ReadonlyArray<QueuedEvent> => {
    const events: unknown = args?.events
    if (!Array.isArray(events)) return []
    return events.flatMap((entry: unknown): ReadonlyArray<QueuedEvent> => {
        if (!isRecord(entry) || typeof entry.wakeId !== "string" || !isRecord(entry.scope)) return []
        return [{ wakeId: entry.wakeId, scope: jsonObjectOf(entry.scope) }]
    })
}

@Injectable()
/**
 * THE RUN QUEUE (D5 of the one event pipeline; ROAD-API section 4): an event of a run's key that arrived while the run was in flight is
 * queued on it, and the next step visit of the run TAKES what is queued as a fixed snapshot (`ctx.run.queue`). Queued means: a pending wake
 * of the run's own lock scope and workflow (the lease kept the drain off it while a step ran), or, for a step that runs again after a
 * person's decision, an event held behind the run (`waiting:<run>`, rule Q-1) while it waited at its stop. The snapshot is written once per step visit in the effect ledger (`queue:<run>:<step>:<visit>`, the visit
 * being the founder answers the step's turn carries): a re-run of the same visit reads the same events and takes nothing new; a visit
 * after an answer keeps what the step took before and adds what came since. Taking closes the wake (`queued:<run>`), pending or held, so
 * the drain starts no run for it and the release offers none of it again; what no step took starts the next run of the key.
 */
export class AgentGraphRunQueueService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly runs: AgentRunsService,
        private readonly wakes: DeliveredWakesService,
        @Optional() @Inject(NODE_EFFECT_STORE) private readonly ledger?: NodeEffectStore,
        @Optional() private readonly raw?: AgentGraphRawRowsService,
    ) {}

    /** The queue snapshot of a step visit: the scopes of the events it took, oldest first; none outside a run or with no ledger. */
    async snapshotOf(turn: NodeTurn, place: StepPlace | null, afterDecision = false): Promise<ReadonlyArray<JsonObject>> {
        const { ledger } = this
        if (place === null || ledger === undefined) return []
        const visit = (turn.founderAnswers ?? []).length
        const key = snapshotKeyOf(place.runId, place.stepKey, visit)
        const kept = await ledger.byKey(turn.workspaceId, key)
        if (kept !== null) {
            const events = eventsOf(kept.args)
            // A crash between the snapshot and the claim: the claim is made again (it changes nothing when it was made).
            await this.claim(turn.workspaceId, place.runId, events)
            return events.map((event) => event.scope)
        }
        const before =
            visit === 0 ? [] : eventsOf((await ledger.byKey(turn.workspaceId, snapshotKeyOf(place.runId, place.stepKey, visit - 1)))?.args ?? null)
        const fresh = await this.queuedOf(turn.workspaceId, place.runId, await this.isFirstVisit(turn.workspaceId, place.runId), afterDecision)
        const taken = new Set(before.map((event) => event.wakeId))
        const events = [...before, ...fresh.filter((event) => !taken.has(event.wakeId))]
        const wrote = await ledger.insert(turn.workspaceId, {
            effectKey: key,
            effectId: QUEUE_EFFECT,
            subjectEntity: "agent_run",
            subjectId: place.runId,
            runId: place.runId,
            stepKey: place.stepKey,
            args: { events: events.map((event) => ({ wakeId: event.wakeId, scope: event.scope })) },
            facts: { count: events.length },
        })
        // A lost race: another try of the same visit wrote its snapshot first; that one is the visit's.
        const settled = wrote ? events : eventsOf((await ledger.byKey(turn.workspaceId, key))?.args ?? null)
        await this.claim(turn.workspaceId, place.runId, settled)
        return settled.map((event) => event.scope)
    }

    /**
     * What is queued on the run and not taken yet, oldest first: the events held behind it (`waiting:<run>`, rule Q-1) while it waited at a stop, then the
     * pending wakes of its own lock scope that its own workflow's registration took (a wake of another workflow on the same key starts its
     * own run). At most `QUEUE_TAKE_MAX`.
     */
    /**
     * True for the run's FIRST step visit (a run-level ledger row `queue:<run>` written once, insert-or-nothing): only then are the
     * pending wakes of its subject taken (the next run takes the whole waiting list). No event is pushed into a run that has started: a
     * step visit after a person's decision on a stop of the run takes the events held behind it while it waited (R18, rule Q-1).
     * With no ledger, every visit is the first.
     */
    private async isFirstVisit(workspaceId: string, runId: string): Promise<boolean> {
        const { ledger } = this
        if (ledger === undefined) return true
        const key = `queue:${runId}`
        if ((await ledger.byKey(workspaceId, key)) !== null) return false
        return ledger.insert(workspaceId, {
            effectKey: key,
            effectId: QUEUE_EFFECT,
            subjectEntity: "agent_run",
            subjectId: runId,
            runId,
            stepKey: null,
            args: null,
            facts: null,
        })
    }

    /**
     * `run.waiting` (the final rule): how many events of the run's subject wait behind it now (wakes held `waiting:<run>`), read once per
     * step visit and kept with its snapshot, so a re-run of the visit reads the same number. 0 outside a run.
     */
    async waitingOf(turn: NodeTurn, place: StepPlace | null): Promise<number> {
        const { ledger } = this
        if (place === null || ledger === undefined) return 0
        const visit = (turn.founderAnswers ?? []).length
        const kept = await ledger.byKey(turn.workspaceId, `waiting:${place.runId}:${place.stepKey}:${visit}`)
        const held: unknown = kept?.facts?.waiting
        if (typeof held === "number") return held
        const waiting = await this.wakes.waitingCountOf(this.entityManager, turn.workspaceId, place.runId)
        await ledger.insert(turn.workspaceId, {
            effectKey: `waiting:${place.runId}:${place.stepKey}:${visit}`,
            effectId: QUEUE_EFFECT,
            subjectEntity: "agent_run",
            subjectId: place.runId,
            runId: place.runId,
            stepKey: place.stepKey,
            args: null,
            facts: { waiting },
        })
        const settled: unknown = (await ledger.byKey(turn.workspaceId, `waiting:${place.runId}:${place.stepKey}:${visit}`))?.facts?.waiting
        return typeof settled === "number" ? settled : waiting
    }

    private async queuedOf(workspaceId: string, runId: string, first: boolean, afterDecision: boolean): Promise<ReadonlyArray<QueuedEvent>> {
        const run = await this.runs.runOf(workspaceId, runId)
        if (run === null) return []
        // After a person decided on a stop of the run, its step visits take the events held behind it while it stopped (its work).
        const held = afterDecision ? await this.wakes.heldBehind(this.entityManager, workspaceId, runId, QUEUE_TAKE_MAX) : []
        const fromHolds: Array<QueuedEvent> = []
        for (const wake of held) fromHolds.push({ wakeId: wake.id, scope: await this.scopeOfWake(workspaceId, wake) })
        const scopeKey: unknown = run.context[THREAD_SCOPE]
        const workflowId: unknown = run.context.workflowId
        if (!first || typeof scopeKey !== "string" || typeof workflowId !== "string") return fromHolds.slice(0, QUEUE_TAKE_MAX)
        const pending = await this.wakes.pendingOfScope(this.entityManager, workspaceId, run.agentId, scopeKey, QUEUE_TAKE_MAX)
        const ours = pending.filter((wake) => wake.context.workflowId === workflowId && pipelineVerbOf(wake.context) !== null)
        const fromWakes: Array<QueuedEvent> = []
        for (const wake of ours) fromWakes.push({ wakeId: wake.id, scope: await this.scopeOfWake(workspaceId, wake) })
        return [...fromHolds, ...fromWakes].slice(0, QUEUE_TAKE_MAX)
    }

    /** The scope a queued wake gives its step: the generic members of the pipeline, its verb and when it was queued. */
    private async scopeOfWake(workspaceId: string, wake: PendingScopeWake): Promise<JsonObject> {
        const { verb, eventId, connectionId, contactId, conversationId } = wake.context
        const event = (await this.raw?.pipelineEventOf({ workspaceId, context: wake.context })) ?? { data: {} }
        return jsonObjectOf({
            verb: verb ?? "",
            at: wake.createdAt.toISOString(),
            eventId: eventId ?? "",
            ...(connectionId === undefined ? {} : { accountId: connectionId }),
            ...(contactId === undefined ? {} : { contactId }),
            ...(conversationId === undefined ? {} : { routeId: conversationId }),
            ...(event.subject === undefined ? {} : { subject: event.subject }),
            data: event.data,
        })
    }

    /** Takes the events of a snapshot: closes their wakes, pending or held behind the run (`queued:<run>`). Idempotent. */
    private async claim(workspaceId: string, runId: string, events: ReadonlyArray<QueuedEvent>): Promise<void> {
        const ids = events.map((event) => event.wakeId)
        if (ids.length === 0) return
        await this.wakes.claimQueued(this.entityManager, workspaceId, ids, runId)
    }
}
