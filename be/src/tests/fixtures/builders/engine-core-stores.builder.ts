import type { RunStop, StopState, StopValues } from "@modules/domain/agent-threads/stops/run-stop.contracts"
import type { RunStopInsert, RunStopStore } from "@modules/domain/agent-threads/stops/run-stop-store.port"

// THE ENGINE'S CORE TABLES IN MEMORY: the doubles of the stores the engine keeps its own bookkeeping in (the stops), for the
// unit specs and the thread worlds. Each keeps the rows its table keeps, the unique key the table declares, a version that moves on
// every write (the fence the services write under) and every write in order. A double changes only HOW it stores, never what it answers.

/** A copy that a caller cannot change the stored row through. */
const copyOf = <T>(value: T): T => structuredClone(value)

/** The stops of the runs (public.run_stops) in memory: unique per run and step, a version per write. */
export class MemoryRunStopStore implements RunStopStore {
    /** The stops, in the order first written. */
    readonly rows: Array<RunStop> = []

    /** Every insert and update, in order. */
    readonly writes: Array<{ readonly op: "insert" | "update"; readonly id: string; readonly values: StopValues }> = []

    private next = 0

    constructor(rows: ReadonlyArray<RunStop> = []) {
        this.rows.push(...rows.map((one) => copyOf(one)))
    }

    byRunStep(_ws: string, runId: string, stepKey: string): Promise<RunStop | null> {
        const found = this.rows.find((stop) => stop.runId === runId && stop.stepKey === stepKey)
        return Promise.resolve(found === undefined ? null : copyOf(found))
    }

    byId(_ws: string, id: string): Promise<RunStop | null> {
        const found = this.rows.find((stop) => stop.id === id)
        return Promise.resolve(found === undefined ? null : copyOf(found))
    }

    ofRun(_ws: string, runId: string, limit: number): Promise<ReadonlyArray<RunStop>> {
        return Promise.resolve(this.rows.filter((stop) => stop.runId === runId).slice(0, limit).map((one) => copyOf(one)))
    }

    newest(_ws: string, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return Promise.resolve(
            this.rows
                .filter((stop) => stop.state === state)
                .toSorted((left, right) => (left.stoppedAt === right.stoppedAt ? right.id.localeCompare(left.id) : right.stoppedAt.localeCompare(left.stoppedAt)))
                .slice(0, limit)
                .map((one) => copyOf(one)),
        )
    }

    ofContacts(_ws: string, contactIds: ReadonlyArray<string>, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return Promise.resolve(
            this.rows
                .filter((stop) => stop.state === state && stop.contactId !== null && contactIds.includes(stop.contactId))
                .slice(0, limit)
                .map((one) => copyOf(one)),
        )
    }

    ofRoutes(_ws: string, routeIds: ReadonlyArray<string>, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return Promise.resolve(
            this.rows
                .filter((stop) => stop.state === state && stop.conversationId !== null && routeIds.includes(stop.conversationId))
                .slice(0, limit)
                .map((one) => copyOf(one)),
        )
    }

    countIn(_ws: string, state: StopState): Promise<number> {
        return Promise.resolve(this.rows.filter((stop) => stop.state === state).length)
    }

    insert(_ws: string, stop: RunStopInsert): Promise<RunStop | null> {
        if (this.rows.some((held) => held.runId === stop.runId && held.stepKey === stop.stepKey)) return Promise.resolve(null)
        this.next += 1
        const row: RunStop = { ...copyOf(stop), id: `stop-${this.next}`, version: "1" }
        this.rows.push(row)
        this.writes.push({ op: "insert", id: row.id, values: copyOf(stop) })
        return Promise.resolve(copyOf(row))
    }

    update(_ws: string, id: string, expected: string, values: StopValues): Promise<RunStop | null> {
        const at = this.rows.findIndex((stop) => stop.id === id)
        const held = this.rows[at]
        if (held?.version !== expected) return Promise.resolve(null)
        const row: RunStop = { ...held, ...copyOf(values), version: String(Number(held.version) + 1) }
        this.rows[at] = row
        this.writes.push({ op: "update", id, values: copyOf(values) })
        return Promise.resolve(copyOf(row))
    }
}
