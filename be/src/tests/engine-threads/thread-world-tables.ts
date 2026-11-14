import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { RunStop, StopState, StopValues } from "@modules/domain/agent-threads/stops/run-stop.contracts"
import type { RunStopInsert, RunStopStore } from "@modules/domain/agent-threads/stops/run-stop-store.port"
import type { MemoryRecords } from "./thread-world-records"

// THE ENGINE'S CORE TABLES OF THE WORLD: the stores of the engine's own bookkeeping (the stops) kept in the world's one
// in-memory database (`MemoryRecords`) under their TABLE names, every write through its mutation path, so a spec's crash hook and its
// reads of the database see them as the app's tables. The rows keep the stores' own members (camelCase); nothing else changes.

/** The table of the stops of the runs. */
export const RUN_STOPS = "run_stops"

/** A JSON copy of a store's values, as a row keeps them. */
const valuesOf = (values: object): MutationValues => structuredClone({ ...values }) as MutationValues

/** Writes one mutation through the world's database: its crash hook, its unique keys, its versions. */
const written = (records: MemoryRecords, mutation: Mutation): RecordRow | null => {
    const result = records.write(mutation)
    return result.ok ? result.row : null
}

/** A stored row as the store's own type: its members, its id and its version. */
const asStop = (row: RecordRow): RunStop => ({ ...(structuredClone(row.data) as unknown as RunStop), id: row.id, version: row.version })

/** The stops of the world's runs, on its database. */
export const worldRunStopStore = (records: MemoryRecords): RunStopStore => ({
    byRunStep: (_ws, runId, stepKey) => Promise.resolve(records.of(RUN_STOPS, { runId, stepKey }).map((entry) => asStop(entry)).at(0) ?? null),
    byId: (_ws, id) => {
        const row = records.get(RUN_STOPS, id)
        return Promise.resolve(row === null ? null : asStop(row))
    },
    ofRun: (_ws, runId, limit) => Promise.resolve(records.of(RUN_STOPS, { runId }).map((entry) => asStop(entry)).slice(0, limit)),
    newest: (_ws, state: StopState, limit) =>
        Promise.resolve(
            records
                .of(RUN_STOPS, { state })
                .map((entry) => asStop(entry))
                .toSorted((left, right) => right.stoppedAt.localeCompare(left.stoppedAt))
                .slice(0, limit),
        ),
    ofContacts: (_ws, contactIds, state: StopState, limit) =>
        Promise.resolve(
            records
                .of(RUN_STOPS, { state })
                .map((entry) => asStop(entry))
                .filter((stop) => stop.contactId !== null && contactIds.includes(stop.contactId))
                .slice(0, limit),
        ),
    ofRoutes: (_ws, routeIds, state: StopState, limit) =>
        Promise.resolve(
            records
                .of(RUN_STOPS, { state })
                .map((entry) => asStop(entry))
                .filter((stop) => stop.conversationId !== null && routeIds.includes(stop.conversationId))
                .slice(0, limit),
        ),
    countIn: (_ws, state: StopState) => Promise.resolve(records.of(RUN_STOPS, { state }).length),
    insert: (_ws, stop: RunStopInsert) => {
        const row = written(records, { op: "insert", entity: RUN_STOPS, values: valuesOf(stop) })
        return Promise.resolve(row === null ? null : asStop(row))
    },
    update: (_ws, id, expected, values: StopValues) => {
        const row = written(records, { op: "update", entity: RUN_STOPS, key: id, expected, values: valuesOf(values) })
        return Promise.resolve(row === null ? null : asStop(row))
    },
})
