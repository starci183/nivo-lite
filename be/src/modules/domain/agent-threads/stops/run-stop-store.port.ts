import type { EntityManager } from "typeorm"
import type { RunStop, StopState, StopValues } from "./run-stop.contracts"

/** A new stop as the store writes it: every member but the id and the version. */
export type RunStopInsert = Omit<RunStop, "id" | "version">

/**
 * The stops of the engine's runs (public.run_stops): reads and writes, each scoped to the workspace it names. `manager` joins a caller's
 * own transaction (a stop opening with the writes that go with it); without it every member is one statement of its own.
 */
export interface RunStopStore {
    /** The stop of a step of a run, or null. */
    byRunStep(workspaceId: string, runId: string, stepKey: string, manager?: EntityManager): Promise<RunStop | null>
    /** One stop by id, or null. */
    byId(workspaceId: string, id: string, manager?: EntityManager): Promise<RunStop | null>
    /** The stops of a run, in the order they were first written, at most `limit`. */
    ofRun(workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<RunStop>>
    /** The newest stops of one state of the workspace, at most `limit`. */
    newest(workspaceId: string, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>>
    /** The stops of one state about any of the contacts, in the order they were first written, at most `limit`. */
    ofContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        state: StopState,
        limit: number,
    ): Promise<ReadonlyArray<RunStop>>
    /** The stops of one state about any of the routes, in the order they were first written, at most `limit`. */
    ofRoutes(workspaceId: string, routeIds: ReadonlyArray<string>, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>>
    /** How many stops of the workspace stand in one state. */
    countIn(workspaceId: string, state: StopState): Promise<number>
    /** Writes a new stop; null when the run and step hold one already (nothing written). */
    insert(workspaceId: string, stop: RunStopInsert, manager?: EntityManager): Promise<RunStop | null>
    /** Writes members of a stop at the version read; null when another write moved it first or it is gone (nothing written). */
    update(workspaceId: string, id: string, expected: string, values: StopValues, manager?: EntityManager): Promise<RunStop | null>
}

/** The injection token of the run stop store. */
export const RUN_STOP_STORE: unique symbol = Symbol("RUN_STOP_STORE")
