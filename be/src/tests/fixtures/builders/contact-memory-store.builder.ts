import type {
    ContactMemoryEntry,
    ContactMemoryStore,
    ContactMemoryTx,
    ContactMemoryValues,
} from "@modules/domain/contacts/contact-memory-store.port"

/** One write the in-memory store took, in order: what a spec reads back instead of the database. */
export type MemoryStoreWrite =
    | { readonly op: "put"; readonly values: ContactMemoryValues }
    | { readonly op: "update"; readonly id: string; readonly expected: number; readonly values: Partial<ContactMemoryValues> }
    | { readonly op: "remove"; readonly id: string }

const textOrder = (left: string, right: string): number => {
    if (left < right) return -1
    return left > right ? 1 : 0
}
const byId = (left: ContactMemoryEntry, right: ContactMemoryEntry): number => textOrder(left.id, right.id)

/** The contacts' memory table in memory: the entries, a version that moves on every write, every write in order. */
export class MemoryContactMemoryStore implements ContactMemoryStore {
    /** The entries, in id order of insertion. */
    readonly entries: Array<ContactMemoryEntry>

    /** Every write, in order. */
    readonly writes: Array<MemoryStoreWrite> = []

    private next = 0

    constructor(
        entries: ReadonlyArray<ContactMemoryEntry> = [],
        private readonly stamp: () => string = () => new Date(0).toISOString(),
    ) {
        this.entries = [...entries]
    }

    transaction<T>(work: (tx: ContactMemoryTx) => Promise<T>): Promise<T> {
        return work(this.tx())
    }

    private tx(): ContactMemoryTx {
        return {
            entriesOf: (_ws, keys, limit) =>
                Promise.resolve(this.entries.filter((entry) => keys.includes(entry.subjectKey)).toSorted(byId).slice(0, limit)),
            entriesOfRunNode: (_ws, runId, nodeKey, limit) =>
                Promise.resolve(
                    this.entries.filter((entry) => entry.runId === runId && entry.nodeKey === nodeKey).toSorted(byId).slice(0, limit),
                ),
            entryOf: (_ws, entryKey) => Promise.resolve(this.entries.find((entry) => entry.entryKey === entryKey) ?? null),
            put: (_ws, values) => {
                this.writes.push({ op: "put", values })
                const at = this.entries.findIndex((entry) => entry.entryKey === values.entryKey)
                const held = this.entries[at]
                if (held === undefined) {
                    this.next += 1
                    this.entries.push({ ...values, id: `memory-${String(this.next).padStart(4, "0")}`, version: 1, updatedAt: this.stamp() })
                } else this.entries[at] = { ...held, ...values, version: held.version + 1, updatedAt: this.stamp() }
                return Promise.resolve()
            },
            update: (_ws, id, expected, values) => {
                this.writes.push({ op: "update", id, expected, values })
                const at = this.entries.findIndex((entry) => entry.id === id)
                const held = this.entries[at]
                if (held?.version !== expected) return Promise.resolve(false)
                this.entries[at] = { ...held, ...values, version: held.version + 1, updatedAt: this.stamp() }
                return Promise.resolve(true)
            },
            remove: (_ws, ids) => {
                for (const id of ids) {
                    this.writes.push({ op: "remove", id })
                    const at = this.entries.findIndex((entry) => entry.id === id)
                    if (at >= 0) this.entries.splice(at, 1)
                }
                return Promise.resolve()
            },
            dueBefore: (_ws, now, limit) =>
                Promise.resolve(
                    this.entries
                        .filter((entry) => entry.expiresAt < now.toISOString())
                        .toSorted((left, right) => (left.expiresAt === right.expiresAt ? byId(left, right) : textOrder(left.expiresAt, right.expiresAt)))
                        .slice(0, limit),
                ),
        }
    }
}

/** A stored entry of `values` under an id, at its first version. */
export const memoryEntryOf = (values: ContactMemoryValues, id: string, updatedAt: string = values.writtenAt): ContactMemoryEntry => ({
    ...values,
    id,
    version: 1,
    updatedAt,
})
