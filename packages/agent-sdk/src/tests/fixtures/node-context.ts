import { RightsDeniedError } from "../../node/rights-denied-error"
import type { NodeContext, NodeStore, SubjectRef, TurnRef } from "../../node/node.types"
import { rightsGaps } from "../../rights/rights"
import type { RightsGrant } from "../../rights/rights.types"
import type { Namespaced } from "../../schema/schema.types"

/** What a node test tunes. */
export interface SampleNodeOptions {
    /** The grant the agent holds; nothing when absent (default deny). */
    readonly grant?: RightsGrant
    /** The records the data port holds, by kind; none when absent. */
    readonly store?: NodeStore
    /** The fields of the turn to override. */
    readonly turn?: Partial<TurnRef>
    /** The time `now` answers; the epoch when absent. */
    readonly now?: Date
}

/** A node context for a node test, with the effects and writes it saw. */
export interface SampleNodeContext extends NodeContext {
    /** The effects the node recorded, in order. */
    readonly effects: ReadonlyArray<{
        readonly kind: Namespaced
        readonly subject: SubjectRef
    }>
    /** The records the node wrote, in order. */
    readonly writes: ReadonlyArray<{ readonly kind: string; readonly record: Readonly<Record<string, unknown>> }>
}

/** Whether a stored row matches every `where` entry. */
const matches = (
    row: Readonly<Record<string, unknown>>,
    where: Readonly<Record<string, string | number | boolean>>,
): boolean => Object.entries(where).every(([name, value]) => row[name] === value)

/** The row cut to the asked fields. */
const pick = (
    row: Readonly<Record<string, unknown>>,
    fields: ReadonlyArray<string>,
): Readonly<Record<string, unknown>> => Object.fromEntries(fields.map((field) => [field, row[field]]))

/** The cut rows as the type the caller asked for; a double cannot know that type, so the caller states it. */
function rowsAs<T>(rows: ReadonlyArray<Readonly<Record<string, unknown>>>): ReadonlyArray<T>
function rowsAs(
    rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): ReadonlyArray<Readonly<Record<string, unknown>>> {
    return rows
}

/** A node context over an in-memory store, enforcing the grant the way the host does: default deny. */
export const sampleNodeContext = (options: SampleNodeOptions = {}): SampleNodeContext => {
    const grant = options.grant ?? { rights: [] }
    const effects: Array<SampleNodeContext["effects"][number]> = []
    const writes: Array<SampleNodeContext["writes"][number]> = []
    return {
        turn: {
            turnId: "turn-1",
            workspaceId: "workspace-1",
            agentId: "agent-1",
            subject: null,
            ...options.turn,
        },
        data: {
            read: <T>(kind: string, query: Parameters<NodeContext["data"]["read"]>[1]): Promise<ReadonlyArray<T>> => {
                const [first, ...rest] = query.fields
                if (first === undefined) throw new RightsDeniedError(kind)
                const required = { kind, access: "read", scope: "turn", fields: [first, ...rest] } as const
                if (rightsGaps(grant, [required]).length > 0) throw new RightsDeniedError(kind)
                const rows = (options.store?.[kind] ?? []).filter((row) => matches(row, query.where ?? {}))
                const cut = rows.slice(0, query.limit ?? rows.length).map((row) => pick(row, query.fields))
                return Promise.resolve(rowsAs<T>(cut))
            },
            write: (kind, record) => {
                const required = {
                    kind,
                    access: "write",
                    scope: "turn",
                    fields: [Object.keys(record)[0] ?? "id"],
                } as const
                if (rightsGaps(grant, [required]).length > 0) throw new RightsDeniedError(kind)
                writes.push({ kind, record })
                return Promise.resolve({ kind, id: `${kind}-${writes.length}` })
            },
        },
        effect: (kind, subject) => {
            effects.push({ kind, subject })
        },
        now: () => options.now ?? new Date(0),
        effects,
        writes,
    }
}
