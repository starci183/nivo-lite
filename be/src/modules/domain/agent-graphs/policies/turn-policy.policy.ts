import type { EntityDefinition, UniqueConstraint } from "@nivo-lite/agent-sdk/entity"
import type { Query } from "@nivo-lite/agent-sdk/query"

/** One value of an agent's policy: a number, a word or a switch. */
export type PolicyValue = number | string | boolean

/** The values of an agent's policy by name. */
export type PolicyValues = Readonly<Record<string, PolicyValue>>

/** A line a step already sent the customer: its words and when it was sent. */
export interface SentLine {
    /** The words. */
    readonly text: string
    /** When it was sent, ISO text. */
    readonly at: string
}

/** The most lines of a conversation looked at to find what a step already sent, newest first. */
export const SENT_LINES_LOOKED_AT = 20

/** The entity a module keeps its workspace settings in: the saved values a policy default is replaced by. */
export const settingsEntityOf = (moduleKey: string): string => `${moduleKey}.settings`

/**
 * The read of a module's one settings record, cut to the names asked, in the order the entity is indexed on: a settings entity keeps
 * one record per workspace under an unconditional unique key (`key`, `scope`), and the index behind that key (its fields, then the id)
 * serves the order. Null when the entity declares no such key: it is then no one-record-per-workspace settings entity, and the policy
 * keeps its defaults rather than sending the engine a query no index serves.
 */
export const settingsQueryOf = (entity: EntityDefinition, names: ReadonlyArray<string>): Query | null => {
    const unique = (entity.constraints ?? []).find(
        (constraint): constraint is UniqueConstraint => constraint.kind === "unique" && constraint.where === undefined,
    )
    if (unique === undefined) return null
    return {
        from: entity.name,
        select: [...names],
        order: [...unique.on.map((field): [string, "asc"] => [field, "asc"]), ["id", "asc"]],
        page: { size: 1 },
    }
}

/** The names of a policy that a settings record can hold: those the record declares a field for. */
export const savedNamesOf = (defaults: PolicyValues, fields: ReadonlyArray<string>): ReadonlyArray<string> =>
    Object.keys(defaults).filter((name) => fields.includes(name))

/**
 * The values of a policy as they stand for a workspace: the defaults its module declares, each replaced by the value the workspace
 * saved under the same name when that value is of the default's own kind (a number for a number). A saved value of another kind, or a
 * name the policy does not declare, changes nothing.
 */
export const policyValuesOf = (defaults: PolicyValues, saved: Readonly<Record<string, unknown>>): PolicyValues =>
    Object.fromEntries(
        Object.entries(defaults).map(([name, value]): [string, PolicyValue] => {
            const own = saved[name]
            const fits = typeof own === typeof value && (typeof own !== "number" || Number.isFinite(own))
            return [name, fits && (typeof own === "number" || typeof own === "string" || typeof own === "boolean") ? own : value]
        }),
    )

/** The start of the key every line of a step is kept under in a conversation: `line:<run>:<step>:`. */
export const stepLinePrefixOf = (stepKey: string): string => `line:${stepKey}:`

/** The time of a row as ISO text, or null when the row holds none. */
const timeOf = (value: unknown): string | null => {
    if (value instanceof Date) return value.toISOString()
    return typeof value === "string" && value !== "" ? value : null
}

/**
 * The lines a step already sent, oldest first, among the rows of its conversation: those kept under the step's own key, with their
 * words and their time. A row of another step, of a person, or with no words is left out.
 */
export const sentLinesOf = (rows: ReadonlyArray<Readonly<Record<string, unknown>>>, stepKey: string): ReadonlyArray<SentLine> => {
    const prefix = stepLinePrefixOf(stepKey)
    return rows
        .flatMap((row) => {
            const at = timeOf(row.sentAt)
            const mine = typeof row.channelRef === "string" && row.channelRef.startsWith(prefix)
            return mine && typeof row.text === "string" && row.text !== "" && at !== null ? [{ text: row.text, at }] : []
        })
        .sort((left, right) => left.at.localeCompare(right.at))
}
