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

/** The entity of the effect ledger (`agent.node-effect`): one record per call, with its run, step, arguments and facts (D.1). */
export const LEDGER_ENTITY: string = "agent.node-effect"

/** The entity of the stops of a run (`agent.run-stop`): one per run and step, with what the customer was told for it. */
export const STOP_ENTITY: string = "agent.run-stop"

/** The entity of a customer conversation, whose `leadId` names the customer. */
export const CONVERSATION_ENTITY: string = "chat.conversation"

/** The data kind of a customer record, when it is the turn's subject. */
export const LEAD_KIND: string = "sales-lead"

/** The most lines a turn is told were already sent: the newest, oldest first. */
export const ALREADY_SENT_MAX: number = 20

/** The most records of one run step read back from the ledger. */
export const STEP_RECORDS_LOOKED_AT: number = 100

/** The most stops of one customer looked at, per state. */
export const STOPS_LOOKED_AT: number = 20

/** How long the lines told for a stop that was resolved still count as told: a day. */
export const RESOLVED_STOP_COUNTS_MS: number = 24 * 60 * 60 * 1000

/** A run and a step of it. */
export interface StepPlace {
    /** The run. */
    readonly runId: string
    /** The step (its key in the graph). */
    readonly stepKey: string
}

/** The run and the step of a step key as the engines give it (`<run>:<step>`), or null for any other key. */
export const stepPlaceOf = (key: string): StepPlace | null => {
    const at = key.indexOf(":")
    return at <= 0 || at === key.length - 1 ? null : { runId: key.slice(0, at), stepKey: key.slice(at + 1) }
}

/** The read of the ledger records of one run step, oldest first, served by the ledger's `run_step` index (run, step, id). */
export const stepLedgerQueryOf = (place: StepPlace): Query => ({
    from: LEDGER_ENTITY,
    select: ["effectId", "args", "subjectEntity", "undoneAt"],
    where: {
        op: "and",
        of: [
            { op: "eq", field: "runId", value: place.runId },
            { op: "eq", field: "stepKey", value: place.stepKey },
        ],
    },
    order: [["id", "asc"]],
    page: { size: STEP_RECORDS_LOOKED_AT },
})

/** A ledger record as the engine lists it: its data and when it was written. */
export interface LedgerRow {
    /** The record's data. */
    readonly data: Readonly<Record<string, unknown>>
    /** When it was written (ISO text): just after the call acted. */
    readonly createdAt: string
}

/** The words of a call's arguments, or null when they hold none (or were not kept). */
const wordsOf = (args: unknown): string | null => {
    const text: unknown = typeof args === "object" && args !== null ? Reflect.get(args, "text") : undefined
    return typeof text === "string" && text !== "" ? text : null
}

/**
 * The lines told to a customer among the ledger records of a step, oldest first: the records of the effects named (the customer
 * send), with the words of their kept arguments and the time they were kept. A record whose arguments were not kept says nothing.
 */
export const ledgerLinesOf = (rows: ReadonlyArray<LedgerRow>, effects: ReadonlyArray<string>): ReadonlyArray<SentLine> =>
    rows
        .flatMap((row) => {
            const text = wordsOf(row.data.args)
            return typeof row.data.effectId === "string" && effects.includes(row.data.effectId) && text !== null
                ? [{ text, at: row.createdAt }]
                : []
        })
        .sort((left, right) => left.at.localeCompare(right.at))

/** The read of the stops of one customer in one state, served by the stops' `lead_state` index (lead, state, id). */
export const leadStopsQueryOf = (leadId: string, state: "open" | "resolved"): Query => ({
    from: STOP_ENTITY,
    select: ["runId", "stepKey", "customerLines", "resolvedAt"],
    where: {
        op: "and",
        of: [
            { op: "eq", field: "leadId", value: leadId },
            { op: "eq", field: "state", value: state },
        ],
    },
    order: [["id", "asc"]],
    page: { size: STOPS_LOOKED_AT },
})

/** What a stop says the customer was told: its run and step, the lines it holds, and when it was resolved (null while open). */
export interface StopTold {
    /** The run of the stop. */
    readonly runId: string
    /** The step of the stop. */
    readonly stepKey: string
    /** The lines the stop holds (the engine's holding line and those recorded on it). */
    readonly lines: ReadonlyArray<SentLine>
    /** When it was resolved, ISO text; null while open. */
    readonly resolvedAt: string | null
}

/** A stop as its record holds it, or null for a record that names no run and step. */
export const stopToldOf = (data: Readonly<Record<string, unknown>>): StopTold | null => {
    if (typeof data.runId !== "string" || typeof data.stepKey !== "string") return null
    const held: unknown =
        typeof data.customerLines === "object" && data.customerLines !== null ? Reflect.get(data.customerLines, "lines") : []
    const lines = (Array.isArray(held) ? held : []).flatMap((line: unknown) => {
        const text = wordsOf(line)
        const at = typeof line === "object" && line !== null ? timeOf(Reflect.get(line, "at")) : null
        return text !== null && at !== null ? [{ text, at }] : []
    })
    return { runId: data.runId, stepKey: data.stepKey, lines, resolvedAt: timeOf(data.resolvedAt) }
}

/**
 * True for a stop whose lines still count as told to the customer at `now`: an open one, or one resolved within the last day. With no
 * clock, only an open one.
 */
export const stopCounts = (stop: StopTold, now: Date | null): boolean => {
    if (stop.resolvedAt === null) return true
    if (now === null) return false
    return now.getTime() - Date.parse(stop.resolvedAt) <= RESOLVED_STOP_COUNTS_MS
}

/**
 * The lines a turn is told were already sent: each wording once (its first time), oldest first, the newest `ALREADY_SENT_MAX` only.
 * Facts only; the agent decides what is new.
 */
export const alreadySentOf = (lines: ReadonlyArray<SentLine>): ReadonlyArray<SentLine> => {
    const first = new Map<string, SentLine>()
    lines
        .toSorted((left, right) => left.at.localeCompare(right.at))
        .forEach((line) => {
            if (!first.has(line.text)) first.set(line.text, line)
        })
    return [...first.values()].slice(-ALREADY_SENT_MAX)
}

/** The subject kinds a ledger record keeps for a call that did NOT act: a refusal, and an act whose outcome is unknown. */
const NOT_DONE_SUBJECTS: ReadonlySet<string> = new Set(["refused", "outcome-unknown"])

/**
 * The effects a run step already did, from its own ledger records (D-W8-1): each effect id once, in name order, of the records that
 * acted and were not taken back. A refusal, an act whose outcome is unknown and an undone act did nothing that a `requires` may count.
 */
export const doneEffectsOf = (rows: ReadonlyArray<LedgerRow>): ReadonlyArray<string> =>
    [
        ...new Set(
            rows.flatMap((row) => {
                const { effectId, subjectEntity, undoneAt } = row.data
                const acted =
                    typeof effectId === "string" &&
                    effectId !== "" &&
                    !(typeof subjectEntity === "string" && NOT_DONE_SUBJECTS.has(subjectEntity)) &&
                    (undoneAt === null || undoneAt === undefined)
                return acted ? [effectId] : []
            }),
        ),
    ].toSorted()
