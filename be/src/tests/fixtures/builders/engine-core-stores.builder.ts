import type { RunStop, StopState, StopValues } from "@modules/domain/agent-threads/stops/run-stop.contracts"
import type { RunStopInsert, RunStopStore } from "@modules/domain/agent-threads/stops/run-stop-store.port"
import type { ContactFreezeStore, FreezeLookup } from "@modules/domain/lead-freezes/contact-freeze-store.port"
import type { FreezeStatus, FreezeSubject, FreezeValues, LeadFreeze } from "@modules/domain/lead-freezes/lead-freezes.contracts"

// THE ENGINE'S CORE TABLES IN MEMORY: the doubles of the stores the engine keeps its own bookkeeping in (stops, freezes), for the
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

const lookupMatches = (freeze: LeadFreeze, lookup: FreezeLookup): boolean => {
    if ("key" in lookup) return freeze.key === lookup.key
    if ("frozenRunId" in lookup) return freeze.frozenRunId === lookup.frozenRunId
    if ("contactId" in lookup) return freeze.contactId === lookup.contactId
    return freeze.id === lookup.id
}

/** The freezes of people (public.contact_freezes) in memory: unique per key, a version per write. */
export class MemoryContactFreezeStore implements ContactFreezeStore {
    /** The freezes, in the order first written. */
    readonly rows: Array<LeadFreeze> = []

    /** Every insert and update, in order. */
    readonly writes: Array<{ readonly op: "insert" | "update"; readonly id: string; readonly values: FreezeValues }> = []

    private next = 0

    constructor(rows: ReadonlyArray<LeadFreeze> = []) {
        this.rows.push(...rows.map((one) => copyOf(one)))
    }

    find(_ws: string, lookup: FreezeLookup): Promise<LeadFreeze | null> {
        const found = this.rows.find((freeze) => lookupMatches(freeze, lookup))
        return Promise.resolve(found === undefined ? null : copyOf(found))
    }

    inStatus(_ws: string, status: FreezeStatus, limit: number): Promise<ReadonlyArray<LeadFreeze>> {
        return Promise.resolve(
            this.rows
                .filter((freeze) => freeze.status === status)
                .toSorted((left, right) => (left.frozenAt ?? "").localeCompare(right.frozenAt ?? ""))
                .slice(0, limit)
                .map((one) => copyOf(one)),
        )
    }

    insert(_ws: string, subject: FreezeSubject, values: FreezeValues): Promise<LeadFreeze | null> {
        if (this.rows.some((freeze) => freeze.key === subject.key)) return Promise.resolve(null)
        this.next += 1
        const row: LeadFreeze = {
            status: "frozen",
            frozenRunId: null,
            agentId: null,
            frozenAt: null,
            frozenReason: null,
            stepKey: null,
            stepTitle: null,
            customerName: null,
            workItemId: null,
            episode: 0,
            failures: 0,
            heldBy: null,
            releasedAt: null,
            releasedBy: null,
            releaseReason: null,
            pending: [],
            ...copyOf(values),
            key: subject.key,
            contactId: subject.contactId,
            conversationId: subject.conversationId,
            id: `freeze-${this.next}`,
            version: "1",
        }
        this.rows.push(row)
        this.writes.push({ op: "insert", id: row.id, values: copyOf(values) })
        return Promise.resolve(copyOf(row))
    }

    update(_ws: string, id: string, expected: string, values: FreezeValues): Promise<LeadFreeze | null> {
        const at = this.rows.findIndex((freeze) => freeze.id === id)
        const held = this.rows[at]
        if (held?.version !== expected) return Promise.resolve(null)
        const row: LeadFreeze = { ...held, ...copyOf(values), version: String(Number(held.version) + 1) }
        this.rows[at] = row
        this.writes.push({ op: "update", id, values: copyOf(values) })
        return Promise.resolve(copyOf(row))
    }
}
