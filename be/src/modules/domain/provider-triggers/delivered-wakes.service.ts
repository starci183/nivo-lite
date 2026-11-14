import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AgentWake, OptionalWakeId } from "@modules/domain/agent-work"
// The door file, not the barrel: the barrel reaches back to this capability through its readers (no import ring at decoration).
import { AgentWakeService, type PendingScopeWake } from "@modules/domain/agent-work/agent-wake.service"

/** An event already delivered, as its wakes name it: the source, the once-key and the reason its wakes ended with. */
export interface DeliveredEventRef {
    readonly source: string
    readonly eventKey: string
    readonly reason: string
}

@Injectable()
/**
 * THE RE-OFFER DOOR of the one delivery piece (lane concept triggers rule 13): every wake of an event ALREADY DELIVERED by `deliver` is
 * held, claimed, offered again, written again or dropped only here, so a wake is written or re-offered only by the delivery piece. The
 * engine's own roads call it: the run queue (claims the wakes queued behind a run), the hand-back (`core.hand-back`), the stop holds
 * (release the wakes held behind a run), the founder-stop replay and the hours gate (write a held event again as the wake it was), the
 * erasure of a subject (drops the wakes held behind its ended runs). None of them is a new outside event. The rows are the wake door's
 * (`AgentWakeService`); this door only names who may move them.
 */
export class DeliveredWakesService {
    constructor(private readonly wakes: AgentWakeService) {}

    /** The pending wakes of one lock scope of an agent, oldest first, at most `limit`: what a run of that scope finds queued for it. */
    pendingOfScope(
        manager: EntityManager,
        workspaceId: string,
        agentId: string,
        scopeKey: string,
        limit: number,
    ): Promise<ReadonlyArray<PendingScopeWake>> {
        return this.wakes.pendingOfScope(manager, workspaceId, agentId, scopeKey, limit)
    }

    /** Claims the wakes a step of a run took into its queue snapshot; how many it closed. */
    claimQueued(manager: EntityManager, workspaceId: string, wakeIds: ReadonlyArray<string>, runId: string): Promise<number> {
        return this.wakes.claimQueued(manager, workspaceId, wakeIds, runId)
    }

    /** The wakes held behind the run (`waiting:<run>`), oldest first, at most `limit`. */
    heldBehind(manager: EntityManager, workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<PendingScopeWake>> {
        return this.wakes.heldBehind(manager, workspaceId, runId, limit)
    }

    /** The runs wakes are held behind in the workspace, at most `limit` (the sweep's backstop). */
    runsHeldBehind(manager: EntityManager, workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        return this.wakes.runsHeldBehind(manager, workspaceId, limit)
    }

    /** How many wakes are held behind the run (`waiting:<run>`). */
    waitingCountOf(manager: EntityManager, workspaceId: string, runId: string): Promise<number> {
        return this.wakes.waitingCountOf(manager, workspaceId, runId)
    }

    /** Offers the wakes held behind an ENDED run again, oldest first; how many. */
    releaseWaiting(tx: EntityManager, workspaceId: string, runId: string): Promise<number> {
        return this.wakes.releaseWaiting(tx, workspaceId, runId)
    }

    /** Offers again every wake of an event a run's wait took and handed back, never to that run again; how many. */
    reoffer(tx: EntityManager, workspaceId: string, event: DeliveredEventRef, runId: string): Promise<number> {
        return this.wakes.reoffer(tx, workspaceId, event, runId)
    }

    /** Drops every wake still waiting to run in the lock scopes of an erased subject (pending or held, of any agent); how many. */
    dropOfScopes(tx: EntityManager, workspaceId: string, scopeKeys: ReadonlyArray<string>, reason: string): Promise<number> {
        return this.wakes.dropOfScopes(tx, workspaceId, scopeKeys, reason)
    }

    /** Drops the wakes held behind a run that ended because its subject was erased; how many. */
    dropWaiting(tx: EntityManager, workspaceId: string, runId: string, reason: string): Promise<number> {
        return this.wakes.dropWaiting(tx, workspaceId, runId, reason)
    }

    /** Writes an already delivered event again as the wake it was (deferred past closed hours, replayed after a stop); its id, or null. */
    rewrite(tx: EntityManager, wake: AgentWake): Promise<OptionalWakeId> {
        return this.wakes.write(tx, wake)
    }

    /** Closes a held wake that a replay wrote again; true when one was closed. */
    superseded(tx: EntityManager, workspaceId: string, heldWakeId: string, replayWakeId: string): Promise<boolean> {
        return this.wakes.superseded(tx, workspaceId, heldWakeId, replayWakeId)
    }

    /** Closes a held wake whose event needs no run any more, with the reason; true when one was closed. */
    closedHeld(tx: EntityManager, workspaceId: string, heldWakeId: string, reason: string): Promise<boolean> {
        return this.wakes.closedHeld(tx, workspaceId, heldWakeId, reason)
    }
}
