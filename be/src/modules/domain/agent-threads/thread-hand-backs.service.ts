import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WAIT_TOOK } from "@modules/domain/agent-graphs"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { TRIGGER_WAKE_SOURCE, eventWakeKeyOf } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import { handBackEventOf, type HandBackEvent } from "./thread-hand-back.policy"

/** What a hand-back did: the event's wakes are offered on again, or nothing could be (no event, not a pipeline event, no engine). */
export type HandBackResult = { readonly kind: "handed_back"; readonly wakes: number } | { readonly kind: "no_event" }

@Injectable()
/**
 * The HAND-BACK step of a thread run (`core.hand-back { wait }`, lane concept engine-core rule 8): the event the named `wait` took in this
 * run is given back. Every wake of that event (one per agent it was delivered to; each ended because a wait took it) is pending again
 * and names this run among the runs that handed it back, so its next drain offers it to the next waiter in the waits' order (never this
 * run again: an event is offered to each run at most once) and, after the last, to the graph its delivery's MATCH chose (or, for a wake
 * only a wait listened to, nothing: `no_waiter`). Nothing is pushed into a started run and the event is never lost: it stays a wake row
 * until a run takes it. Idempotent: a replay of the step re-offers nothing twice (`DeliveredWakesService.reoffer`, the re-offer door of the delivery piece).
 */
export class ThreadHandBacksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly wakes: DeliveredWakesService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
    ) {}

    /**
     * Gives back what the wait took: `output` is the wait step's output (`{ trigger, event }`), `on` the wait's triggers as its params hold
     * them (the verb of the key that came), `agentId` the run's agent (the origin of an engine source's event).
     */
    async handBack(ref: { readonly workspaceId: string; readonly runId: string; readonly agentId: string }, output: unknown, on: unknown): Promise<HandBackResult> {
        const event = handBackEventOf(output, on)
        if (event === null) return { kind: "no_event" }
        const wakes = await this.entityManager.transaction((tx) =>
            this.wakes.reoffer(tx, ref.workspaceId, { source: TRIGGER_WAKE_SOURCE, eventKey: this.eventKeyOf(event, ref.agentId), reason: WAIT_TOOK }, ref.runId),
        )
        this.logger?.info(AgentThreadsLogEvent.WaitHandedBack, { runId: ref.runId, eventId: event.eventId, wakes })
        return { kind: "handed_back", wakes }
    }

    /**
     * A run PARKS on a `wait`: the events held behind it (`waiting:<run>`: its subject's events that came while it was in flight, which no
     * wait took then) are offered to this wait first (lane concept engine-core rule 8: "offered to that run's next `wait` first"). Their
     * wakes are pending again; they drain once this drive gives the subject's lease back (the park's checkpoint is written by then), so
     * the wait takes the first it matches and the rest are held behind the run again (never pushed into it). Answers how many.
     */
    async offerToWait(workspaceId: string, runId: string): Promise<number> {
        return this.entityManager.transaction((tx) => this.wakes.releaseWaiting(tx, workspaceId, runId))
    }

    /** The once-key the delivery wrote the event's wakes under: its verb, its account (or, for an engine source, the agent), its id. */
    private eventKeyOf(event: HandBackEvent, agentId: string): string {
        return eventWakeKeyOf(event.verb, event.accountId ?? agentId, event.eventId)
    }
}
