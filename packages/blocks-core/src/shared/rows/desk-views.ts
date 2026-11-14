import { z } from "zod"
import { graphView, type GraphView } from "./graph-view"

/*
 * What the generic desk blocks read, parsed at the slot: the agent's flows (`core.agent-flows`) and its reach (`core.reach-card`). The
 * shapes are the `platform.agent-flows` and `platform.agent-reach` answers; the blocks own no rule about them.
 */

/** The most workflows, accounts and operation titles a desk card holds. */
const DESK_LIST_MAX = 200

/** The longest text a desk card draws in one field. */
const DESK_TEXT_MAX = 400

const text = z.string().max(DESK_TEXT_MAX)

/** One workflow as the flows card draws it. */
export interface DeskFlowCard {
    /** The workflow key. */
    readonly key: string
    /** Its name. */
    readonly name: string
    /** Whether it is the agent's main workflow. */
    readonly isPrimary: boolean
    /** How many steps it has. */
    readonly steps: number
    /** The card view of its running graph; null when it does not parse. */
    readonly graph: GraphView | null
}

/** The flows card once read. */
export interface DeskFlowsCard {
    /** How many workflows. */
    readonly workflows: number
    /** How many steps in all. */
    readonly steps: number
    /** The workflows, the primary first. */
    readonly flows: ReadonlyArray<DeskFlowCard>
}

/** The shape of the flows card. */
export const deskFlowsView: z.ZodType<DeskFlowsCard> = z.object({
    workflows: z.number().int().nonnegative(),
    steps: z.number().int().nonnegative(),
    flows: z
        .array(
            z.object({
                key: text,
                name: text,
                isPrimary: z.boolean(),
                steps: z.number().int().nonnegative(),
                graph: graphView.nullable(),
            }),
        )
        .max(DESK_LIST_MAX),
})

/** The flows card while it loads: no workflow yet, the frame and its words real. */
export const DESK_FLOWS_PLACEHOLDER: DeskFlowsCard = { workflows: 0, steps: 0, flows: [] }

/** Where an attached account stands. */
export const REACH_STATES = ["connected", "attention", "off"] as const

/** One attached account as the reach card draws it. */
export interface ReachAccountCard {
    /** The connected account. */
    readonly connectionId: string
    /** The name the owner gave it. */
    readonly name: string
    /** The provider's name. */
    readonly providerName: string
    /** Its state. */
    readonly state: (typeof REACH_STATES)[number]
}

/** The reach card once read. */
export interface ReachCard {
    /** The attached accounts. */
    readonly accounts: ReadonlyArray<ReachAccountCard>
    /** The operations it does by itself. */
    readonly auto: ReadonlyArray<string>
    /** The operations it asks a person for first. */
    readonly ask: ReadonlyArray<string>
    /** The operations it never does. */
    readonly none: ReadonlyArray<string>
}

const titles = z.array(text).max(DESK_LIST_MAX)

/** The shape of the reach card. */
export const reachView: z.ZodType<ReachCard> = z.object({
    accounts: z
        .array(
            z.object({
                connectionId: text,
                name: text,
                providerName: text,
                state: z.enum(REACH_STATES),
            }),
        )
        .max(DESK_LIST_MAX),
    auto: titles,
    ask: titles,
    none: titles,
})

/** The reach card while it loads. */
export const REACH_PLACEHOLDER: ReachCard = { accounts: [], auto: [], ask: [], none: [] }

/** The modes a reach card lists, in the order it lists them. */
export const REACH_MODES = ["auto", "ask", "none"] as const

/** The rows of a reach card: each account, then each mode that holds operations, its titles joined. */
export interface ReachRow {
    /** The key of the row. */
    readonly id: string
    /** The account's name, or the operation titles joined. */
    readonly title: string
    /** The provider's name; absent on a mode row. */
    readonly description?: string | undefined
    /** The account's state or the mode, as the chip's key. */
    readonly chip: (typeof REACH_STATES)[number] | (typeof REACH_MODES)[number]
}

/** Joins the operation titles of one mode. */
export const TITLE_SEPARATOR = ", "

/** The modes whose operations the reach card draws: what the agent does itself and what it asks first (the ruling retired a "never" row: what it may not touch is not listed). */
const SHOWN_MODES = ["auto", "ask"] as const

/** The rows of the reach card, in order: accounts, then the modes that hold operations; none when the agent is attached to nothing. */
export const reachRowsOf = (reach: ReachCard): ReadonlyArray<ReachRow> => [
    ...reach.accounts.map((account): ReachRow => ({
        id: `account:${account.connectionId}`,
        title: account.name,
        description: account.providerName,
        chip: account.state,
    })),
    ...SHOWN_MODES.filter((mode) => reach[mode].length > 0).map((mode): ReachRow => ({
        id: `mode:${mode}`,
        title: reach[mode].join(TITLE_SEPARATOR),
        chip: mode,
    })),
]

/** The count of a data set in the counts record: a whole number at the path, or null (no count is drawn, never 0). */
export const setCountOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null

/** How a data set is counted in the counts record: a number at a path, or a sum over a list's rows. */
export interface SetCount {
    /** The path in the answer that holds the number to show. */
    readonly countPath?: string | undefined
    /** The rows of the answer that are counted when no number is given. */
    readonly countRows?:
        | {
              readonly path: string
              readonly value: string
              readonly by?: string | undefined
              readonly keys?: ReadonlyArray<string> | undefined
          }
        | undefined
}

/** A member of a row by a dotted path. */
const memberAt = (record: unknown, path: string): unknown =>
    path
        .split(".")
        .reduce<unknown>(
            (at, step) => (typeof at === "object" && at !== null ? Reflect.get(at, step) : undefined),
            record,
        )

/**
 * The count of a data set: the whole number at `countPath`, or the sum of `countRows`' values over the rows of its list (only the rows
 * whose key is one of `keys` when given); null when the record holds none of it (no count is drawn, never 0).
 */
export const setCountIn = (record: unknown, count: SetCount): number | null => {
    if (count.countPath !== undefined) return setCountOf(memberAt(record, count.countPath))
    const rows = count.countRows
    if (rows === undefined) return null
    const list = memberAt(record, rows.path)
    if (!Array.isArray(list)) return null
    const values = list
        .filter(
            (row) =>
                rows.by === undefined || rows.keys === undefined || rows.keys.includes(String(memberAt(row, rows.by))),
        )
        .map((row) => setCountOf(memberAt(row, rows.value)))
    return values.includes(null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

/** Fills `{name}` marks of a text with values. */
export const filledText = (template: string, values: Readonly<Record<string, string>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(value), template)
