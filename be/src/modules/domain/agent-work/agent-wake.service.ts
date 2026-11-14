import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectAgentTurnQueue, type AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { wakeSources } from "./agent-wake-source.policy"
import { burstFor, scopeKeyOf } from "./agent-work.policy"
import { AgentWakeEntity } from "./persistence/entities"
import type { AgentWake, AgentWakeContext, OptionalWakeId } from "./agent-work.contracts"

/** The reason a held wake is closed with once its event was written again as a new wake: `replayed:<the new wake's id>`. */
export const REPLAYED_REASON = "replayed:"

/** The reason a wake is closed with once a step of a run took it into its queue snapshot: `queued:<run>`. */
export const QUEUED_REASON = "queued:"

/** The reason a wake waits behind the run of its subject in flight (`waiting:<run>`): it is offered to that run's waits, else the next run takes it. */
export const WAITING_REASON = "waiting:"

/** The part of a wake's context that names the runs that handed its event back. */
export type HandedBackHolder = Pick<AgentWakeContext, "handedBackJson">

/** The event a run hands back: the wake source, the event key and the reason its wakes ended with when a wait took them. */
export interface ReofferedEvent {
    /** The wake source of the event. */
    readonly source: string
    /** The event's key, one per agent it was delivered to. */
    readonly eventKey: string
    /** The reason a wait closed the wake with. */
    readonly reason: string
}

/** The runs that handed an event back, as its wake's context names them (`handedBackJson`); none when it names none. */
export const handedBackOf = (context: HandedBackHolder): ReadonlyArray<string> => {
    const text = context.handedBackJson
    if (typeof text !== "string") return []
    try {
        const parsed: unknown = JSON.parse(text)
        return Array.isArray(parsed) ? parsed.filter((one): one is string => typeof one === "string") : []
    } catch {
        return []
    }
}

/** A pending wake of a lock scope, as a run's queue reads it: its id, its ids-only context and when it was written. */
export interface PendingScopeWake {
    /** The wake's id. */
    readonly id: string
    /** The wake's ids-only context. */
    readonly context: AgentWake["context"]
    /** When the wake was written. */
    readonly createdAt: Date
}

/** The id of the row an insert returned, or null when it wrote none. */
const idOf = (raw: unknown): OptionalWakeId => {
    if (!Array.isArray(raw)) return null
    const rows: ReadonlyArray<unknown> = raw
    const [row] = rows
    if (!isRecord(row)) return null
    return typeof row.id === "string" ? row.id : null
}

@Injectable()
/**
 * The one door a wake starts through. It runs in the caller's transaction (BE-PERSISTENCE-5): the wake and the job that drains it commit
 * together or not at all, and the same fact written twice is one wake and one job.
 */
export class AgentWakeService {
    constructor(
        @InjectAgentTurnQueue() private readonly queue: AgentTurnQueue,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes the wake and its drain job in `tx`; answers false when the fact was already written, in which case nothing is enqueued. */
    async wake(tx: EntityManager, wake: AgentWake): Promise<boolean> {
        return (await this.write(tx, wake)) !== null
    }

    /**
     * Closes a held wake whose event was written again as a new wake (a freeze's replay), in the caller's transaction, so the replay and
     * the close commit together: the held wake is `skipped` with the reason `replayed:<new wake>`, pointing at the wake that carries its
     * event now. Only a wake still `held` is closed; true when one was. A held wake left `held` after its replay would answer the same
     * customer line a second time if held wakes were ever released in bulk (D-P11-7).
     */
    async superseded(
        tx: EntityManager,
        workspaceId: string,
        heldWakeId: string,
        replayWakeId: string,
    ): Promise<boolean> {
        const closed = await tx.update(
            AgentWakeEntity,
            { id: heldWakeId, workspaceId, status: "held" },
            { status: "skipped", reason: `${REPLAYED_REASON}${replayWakeId}` },
        )
        return (closed.affected ?? 0) > 0
    }

    /**
     * Closes a held wake whose event needs no run any more, in the caller's transaction (D-MX-3: a bank credit held on a stop and then
     * settled by the run it joined): the held wake is `skipped` with the reason given. Only a wake still `held` is closed; true when one was.
     */
    async closedHeld(tx: EntityManager, workspaceId: string, heldWakeId: string, reason: string): Promise<boolean> {
        const closed = await tx.update(
            AgentWakeEntity,
            { id: heldWakeId, workspaceId, status: "held" },
            { status: "skipped", reason },
        )
        return (closed.affected ?? 0) > 0
    }

    /**
     * Drops, in `tx`, every wake held behind a run that was ENDED because its subject was erased (`waiting:<run>`): each is `skipped` with
     * the reason given and never runs (its person was erased with it). Answers how many it dropped.
     */
    async dropWaiting(tx: EntityManager, workspaceId: string, runId: string, reason: string): Promise<number> {
        const dropped = await tx.update(
            AgentWakeEntity,
            { workspaceId, status: "held", reason: `${WAITING_REASON}${runId}` },
            { status: "skipped", reason },
        )
        return dropped.affected ?? 0
    }

    /**
     * The wakes of one lock scope of an agent still waiting to run, oldest first, at most `limit`: what a run of that scope finds QUEUED for
     * it while it is in flight (the lease keeps the drain off the scope while a step runs). Read on the primary connection.
     */
    async pendingOfScope(
        manager: EntityManager,
        workspaceId: string,
        agentId: string,
        scopeKey: string,
        limit: number,
    ): Promise<ReadonlyArray<PendingScopeWake>> {
        const rows = await manager.find(AgentWakeEntity, {
            where: { workspaceId, agentId, scopeKey, status: "pending" },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, context: row.context, createdAt: row.createdAt }))
    }

    /**
     * Closes the wakes a step of a run took into its queue snapshot: each still `pending` becomes `skipped` with the reason
     * `queued:<run>`, so the drain starts no run for it; one already closed is left as it is (a replay of the claim changes nothing).
     * Answers how many it closed.
     */
    async claimQueued(
        manager: EntityManager,
        workspaceId: string,
        wakeIds: ReadonlyArray<string>,
        runId: string,
    ): Promise<number> {
        if (wakeIds.length === 0) return 0
        const closed = await manager
            .createQueryBuilder()
            .update(AgentWakeEntity)
            .set({ status: "skipped", reason: `${QUEUED_REASON}${runId}`, finishedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND status = 'pending' AND id IN (:...wakeIds)", {
                workspaceId,
                wakeIds: [...wakeIds],
            })
            .execute()
        return closed.affected ?? 0
    }

    /** How many wakes wait behind a run (`waiting:<run>`): what the run's `run.waiting` counts. */
    waitingCountOf(manager: EntityManager, workspaceId: string, runId: string): Promise<number> {
        return manager.count(AgentWakeEntity, {
            where: { workspaceId, status: "held", reason: `${WAITING_REASON}${runId}` },
        })
    }

    /**
     * When the run a subject's events waited behind has ENDED: every wake held `waiting:<run>` is pending again, in the order it came, with
     * its drain job, in `tx`. The oldest begins the next run of the subject and that run's first step takes the rest as its queue (the
     * next run takes the whole list). Answers how many it released.
     */
    async releaseWaiting(tx: EntityManager, workspaceId: string, runId: string): Promise<number> {
        const held = await tx.find(AgentWakeEntity, {
            where: { workspaceId, status: "held", reason: `${WAITING_REASON}${runId}` },
            order: { createdAt: "ASC" },
        })
        await eachInOrder(held, async (wake) => {
            await tx.update(
                AgentWakeEntity,
                { id: wake.id, status: "held" },
                { status: "pending", reason: null, notBefore: () => "now()" },
            )
            await this.queue.enqueueDrain(
                { workspaceId, agentId: wake.agentId, scopeKey: wake.scopeKey },
                wake.source,
                wake.eventKey,
                tx,
                0,
            )
        })
        return held.length
    }

    /**
     * A run HANDS BACK the event its `wait` took (`core.hand-back`): every wake of that event (`source` + `eventKey`, one per agent the
     * event was delivered to) that ended because a wait took it (`reason`) is pending again with its drain job, and names `runId` among
     * the runs that handed it back (`handedBackJson`), so the next drain offers it to the next waiter and, after the last, to the graphs
     * registered on it (the routing its delivery already matched), and never to this run again. A wake already re-offered by this run is
     * left as it is (a replay of the step changes nothing). Answers how many wakes it re-offered.
     */
    async reoffer(tx: EntityManager, workspaceId: string, event: ReofferedEvent, runId: string): Promise<number> {
        const taken = await tx.find(AgentWakeEntity, {
            where: {
                workspaceId,
                source: event.source,
                eventKey: event.eventKey,
                status: "done",
                reason: event.reason,
            },
            order: { createdAt: "ASC" },
        })
        let reoffered = 0
        await eachInOrder(taken, async (wake) => {
            const handers = handedBackOf(wake.context)
            if (handers.includes(runId)) return
            const context = { ...wake.context, handedBackJson: JSON.stringify([...handers, runId]) }
            const moved = await tx.update(
                AgentWakeEntity,
                { id: wake.id, status: "done", reason: event.reason },
                { status: "pending", reason: null, attempts: 0, finishedAt: null, notBefore: () => "now()", context },
            )
            if ((moved.affected ?? 0) === 0) return
            await this.queue.enqueueDrain(
                { workspaceId, agentId: wake.agentId, scopeKey: wake.scopeKey },
                wake.source,
                wake.eventKey,
                tx,
                0,
            )
            reoffered += 1
        })
        return reoffered
    }

    /** Writes the wake and its drain job in `tx` and answers the wake's id; null when the fact was already written, in which case nothing is enqueued. */
    async write(tx: EntityManager, wake: AgentWake): Promise<OptionalWakeId> {
        const traits = wakeSources.of(wake.source)
        const scopeKey = wake.scopeKey ?? scopeKeyOf(wake.source, wake.context)
        // The settle time is the source's (its trigger declaration, written by `deliver`); a wake with none runs at once.
        const burst = wake.settle === undefined ? null : burstFor(wake.settle)
        const inserted = await tx
            .createQueryBuilder(AgentWakeEntity, "w")
            .insert()
            .values({
                workspaceId: wake.workspaceId,
                agentId: wake.agentId,
                source: wake.source,
                eventKey: wake.eventKey,
                scopeKey,
                priority: traits.priority,
                maxAttempts: traits.maxAttempts,
                background: traits.background,
                context: wake.context,
                burstWindowMs: burst?.windowMs ?? null,
                burstMaxMs: burst?.maxWaitMs ?? null,
                actorMemberId: wake.actorMemberId,
            })
            .orIgnore()
            .returning("id")
            .execute()
        const id = idOf(inserted.raw)
        if (id === null) return null
        await this.queue.enqueueDrain(
            { workspaceId: wake.workspaceId, agentId: wake.agentId, scopeKey },
            wake.source,
            wake.eventKey,
            tx,
            wake.delayMs ?? burst?.windowMs ?? 0,
        )
        this.logger.info(AgentWorkLogEvent.WakeWritten, { agentId: wake.agentId, source: wake.source, scopeKey })
        return id
    }
}
