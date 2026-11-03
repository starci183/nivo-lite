import { RightsDeniedError } from "../node/rights-denied-error"
import type { NodeContext, NodeModel, NodeStore, TurnRef } from "../node/node.types"
import { rightsGaps } from "../rights/rights"
import type { RightsGrant } from "../rights/rights.types"
import type { Namespaced } from "../schema/schema.types"

/** What a node test tunes. */
export interface FakeNodeOptions {
    /** The grant the agent holds; nothing when absent (default deny). */
    readonly grant?: RightsGrant
    readonly store?: NodeStore
    readonly turn?: Partial<TurnRef>
    readonly now?: Date
    readonly params?: Readonly<Record<string, unknown>>
    /** The canned answers of the model, in call order; asking past them throws. */
    readonly model?: ReadonlyArray<unknown>
}

/** A node context for a node test, with the effects and writes it saw. */
export interface FakeNodeContext extends NodeContext {
    readonly effects: ReadonlyArray<{
        readonly kind: Namespaced
        readonly subject: { readonly kind: string; readonly id: string }
        readonly payload?: unknown
    }>
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

/** A node context over an in-memory store, enforcing the grant the way the host does: default deny. */
export const fakeNodeContext = (options: FakeNodeOptions = {}): FakeNodeContext => {
    const grant = options.grant ?? { rights: [] }
    const effects: Array<FakeNodeContext["effects"][number]> = []
    const writes: Array<FakeNodeContext["writes"][number]> = []
    const answers = [...(options.model ?? [])]
    const next = (): unknown => {
        if (answers.length === 0) throw new Error("fakeNodeContext: the model was asked more often than the example answers")
        return answers.shift()
    }
    const model: NodeModel = {
        text: async (): Promise<string> => String(next()),
        json: async <T>(schema: { parse: (value: unknown) => T }): Promise<T> => schema.parse(next()),
    }
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
                const cut = rows.slice(0, query.limit).map((row) => pick(row, query.fields))
                return Promise.resolve(cut as ReadonlyArray<T>)
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
        params: options.params ?? {},
        model,
        effect: (kind, subject, payload) => {
            effects.push({ kind, subject, payload })
            return Promise.resolve(subject)
        },
        now: () => options.now ?? new Date(0),
        effects,
        writes,
    }
}
