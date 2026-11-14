import { Inject, Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { RunStopsError, RunStopsErrorCode } from "./errors/run-stops.error"
import type { OptionalRunStop, RunStop, StopOpen, StopState, StopValues } from "./run-stop.contracts"
import { RUN_STOP_STORE, type RunStopStore } from "./run-stop-store.port"

/** How often a write is tried again after another writer moved the stop first. */
const WRITE_TRIES = 5

/** The most stops of one run read at once. */
const RUN_PAGE = 50

/** The most stops of one state of a workspace one read takes. */
const STATE_PAGE = 100

/** The most stops of one state about one customer one read takes. */
const CONTACT_PAGE = 50

/** What a write of a stop answers to build its values from the stop as it stands; null writes nothing. */
export type StopBuild = (stop: RunStop) => StopValues | null

@Injectable()
/**
 * The one door to the stops of the engine's runs (`public.run_stops`, `RUN_STOP_STORE`). Reads are indexed (by run and step: the unique
 * key; by run; by state and moment; by contact and state). A write is an update under the version read, read again and rebuilt when
 * another writer moved the stop first.
 */
export class RunStopRecordsService {
    constructor(@Inject(RUN_STOP_STORE) private readonly store: RunStopStore) {}

    /** The stop of a step of a run, or null. */
    byRunStep(workspaceId: string, runId: string, stepKey: string): Promise<OptionalRunStop> {
        return this.store.byRunStep(workspaceId, runId, stepKey)
    }

    /** One stop by its id, or null. */
    byId(workspaceId: string, id: string): Promise<OptionalRunStop> {
        return this.store.byId(workspaceId, id)
    }

    /** The stops of a run, in the order they were first written. */
    ofRun(workspaceId: string, runId: string): Promise<ReadonlyArray<RunStop>> {
        return this.store.ofRun(workspaceId, runId, RUN_PAGE)
    }

    /** The newest stops of one state of the workspace, at most `limit` (one bounded page). */
    newest(workspaceId: string, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return this.store.newest(workspaceId, state, Math.min(Math.max(limit, 1), STATE_PAGE))
    }

    /** The stops of one state about a customer (their contact and the ids merged into it), in the order first written, at most `limit`. */
    ofContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        state: StopState,
        limit: number,
    ): Promise<ReadonlyArray<RunStop>> {
        return this.store.ofContacts(workspaceId, contactIds, state, Math.min(Math.max(limit, 1), CONTACT_PAGE))
    }

    /** The stops of one state about any of the routes, in the order first written, at most `limit`. */
    ofRoutes(workspaceId: string, routeIds: ReadonlyArray<string>, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return this.store.ofRoutes(workspaceId, routeIds, state, Math.min(Math.max(limit, 1), CONTACT_PAGE))
    }

    /** How many stops of the workspace stand open. */
    openCount(workspaceId: string): Promise<number> {
        return this.store.countIn(workspaceId, "open")
    }

    /**
     * The stop of the step, open: a new stop the first time, else the same stop opened again (one more repeat, the new words, no
     * decision) with its card, customer lines and answers kept. The unique key makes a race find the one written first. `manager`
     * joins the caller's transaction (a stop opens in the caller's own write).
     */
    async open(input: StopOpen, now: string, manager?: EntityManager): Promise<RunStop> {
        const words = {
            kind: input.kind,
            reason: input.reason,
            question: input.question,
            detail: {
                suggestions: input.suggestions,
                facts: input.facts,
                ...(input.approvalCard === undefined ? {} : { approvalCard: input.approvalCard }),
            },
        }
        const made = await this.store.insert(input.workspaceId, {
            ...words,
            runId: input.runId,
            stepKey: input.stepKey,
            agentId: input.agentId,
            workflowId: input.workflowId,
            contactId: input.contactId,
            conversationId: input.conversationId,
            state: "open",
            cardMessageId: null,
            customerLines: [],
            answers: [],
            decision: null,
            repeats: 1,
            stoppedAt: now,
            resolvedAt: null,
        }, manager)
        if (made !== null) return made
        const found = await this.store.byRunStep(input.workspaceId, input.runId, input.stepKey, manager)
        if (found === null) throw new RunStopsError({ code: RunStopsErrorCode.RecordUnreadable })
        const reopened = await this.patchIn(
            input.workspaceId,
            found.id,
            (stop) => ({
                ...words,
                state: "open",
                decision: null,
                repeats: stop.state === "resolved" || stop.decision !== null ? stop.repeats + 1 : stop.repeats,
                stoppedAt: now,
                resolvedAt: null,
            }),
            WRITE_TRIES,
            manager,
        )
        return reopened ?? found
    }

    /**
     * Writes what `build` answers for the stop as it stands, under the version read; when another writer moved it first, it is read and
     * built again. Answers the stop after the write, or null when `build` answered no write.
     */
    patch(workspaceId: string, id: string, build: StopBuild): Promise<OptionalRunStop> {
        return this.patchIn(workspaceId, id, build, WRITE_TRIES)
    }

    private async patchIn(
        workspaceId: string,
        id: string,
        build: StopBuild,
        left: number,
        manager?: EntityManager,
    ): Promise<OptionalRunStop> {
        if (left <= 0) throw new RunStopsError({ code: RunStopsErrorCode.Contended })
        const stop = await this.store.byId(workspaceId, id, manager)
        if (stop === null) throw new RunStopsError({ code: RunStopsErrorCode.NotFound })
        const values = build(stop)
        if (values === null) return null
        const written = await this.store.update(workspaceId, id, stop.version, values, manager)
        return written ?? this.patchIn(workspaceId, id, build, left - 1, manager)
    }
}
