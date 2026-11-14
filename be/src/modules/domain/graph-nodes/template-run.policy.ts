import { z } from "zod"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { attempt } from "@modules/platform/primitives"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** What a template node runs with once the engine resolved its bindings: its settings and its input, split by its two schemas. */
export interface TemplateBindings {
    /** The node's settings, as its params schema reads them. */
    readonly params: Readonly<Record<string, unknown>>
    /** The node's input, as its input schema reads it. */
    readonly input: Readonly<Record<string, unknown>>
}

/** The members of an object schema, or none. */
const membersOf = (schema: z.ZodType | undefined): ReadonlySet<string> =>
    schema instanceof z.ZodObject ? new Set(Object.keys(schema.shape)) : new Set()

/**
 * A @2 step binds a template node's input and settings in ONE place (`params`, by member); the engine resolves them before the node runs
 * (into `params`, as for a node it cannot split itself). The host splits them here by the node's own schemas: a member of the `params`
 * schema is a setting, every other member is input (the input schema refuses what it does not take).
 */
export const splitTemplateBindings = (node: AnyTemplateNode, params: unknown, input: unknown): TemplateBindings => {
    const settings = membersOf(node.params)
    const all = { ...(isRecord(params) ? params : {}), ...(isRecord(input) ? input : {}) }
    const entries = Object.entries(all)
    return {
        params: Object.fromEntries(entries.filter(([name]) => settings.has(name))),
        input: Object.fromEntries(entries.filter(([name]) => !settings.has(name))),
    }
}

/** The item of a run (`ctx.run.item`): the for-each item the engine named, or null outside every loop. */
export const runItemOf = (
    item: { readonly key: string; readonly index: number } | undefined,
): { readonly key: string; readonly index: number } | null => (item === undefined ? null : { key: item.key, index: item.index })

/** The run id of a run step's key (`<run>:<step>`): the part before the first colon. */
export const runIdOfKey = (key: string): string => {
    const at = key.indexOf(":")
    return at === -1 ? key : key.slice(0, at)
}

/** The parts of a calendar day as `Intl` names them. */
const DAY_PARTS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }

/**
 * The run's day (`ctx.run.day`, `YYYY-MM-DD`): the calendar day the run step's instant falls on in the workspace's time zone, so a run
 * at 18:30 UTC is already the next day in Asia/Ho_Chi_Minh. A zone the platform does not know reads as UTC.
 */
export const runDayOf = (at: string, timeZone: string): string => {
    const instant = new Date(at)
    const format = (zone: string): string => {
        const parts = new Intl.DateTimeFormat("en-US", { ...DAY_PARTS, timeZone: zone }).formatToParts(instant)
        const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((one) => one.type === type)?.value ?? ""
        return `${part("year")}-${part("month")}-${part("day")}`
    }
    const named = attempt(() => format(timeZone))
    return named.ok ? named.value : format("UTC")
}
