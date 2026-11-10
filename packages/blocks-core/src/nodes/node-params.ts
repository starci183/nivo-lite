import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { messageNamed } from "../messages/catalog"
import { namePartOf } from "./node-ui"
import type { NodeLocale } from "./node-schema.types"

/** How the owner edits one setting: money in ₫, a length of time, a number, one of a few words, a line or a paragraph, a switch. */
export const PARAM_INPUTS: readonly ["money", "duration", "number", "enum", "text", "boolean"] = [
    "money",
    "duration",
    "number",
    "enum",
    "text",
    "boolean",
]

/** One way to edit a setting. */
export type ParamInput = (typeof PARAM_INPUTS)[number]

/** The unit a duration or a number is stored in; the form shows its word (hours, minutes, days in the language asked). */
export type ParamUnit = "days" | "hours" | "minutes"

/**
 * How one setting of a node is drawn in a form. The words (label, help, each option) are catalog keys derived from the node id and the
 * field, `nodeParam<Node><Field>Label|Help|Option<Value>`; the limits come from the schema unless set here.
 */
export interface ParamUi {
    /** How the owner edits the setting. */
    readonly input: ParamInput
    /** True for a setting the form never shows (a locale, an internal id). */
    readonly hidden?: boolean
    /** The unit of a duration or a number. */
    readonly unit?: ParamUnit
    /** The lowest value; the schema's minimum when absent. */
    readonly min?: number
    /** The highest value; the schema's maximum when absent. */
    readonly max?: number
    /** The values of an `enum`, in the order the form lists them. */
    readonly options?: ReadonlyArray<string>
    /** True for a text that runs over several lines. */
    readonly multiline?: boolean
}

const HIDDEN: ParamUi = { input: "text", hidden: true }
const LINE: ParamUi = { input: "text" }
const OCCASION_LEAD: ParamUi = { input: "number", unit: "days" }

/**
 * The form of every setting of every core node, by node id then field. The form is generated from this and the node's zod `params`
 * (types, defaults, limits), so a setting without an entry here is a failing spec, never a silent gap.
 */
export const NODE_PARAMS_UI: Readonly<Record<string, Readonly<Record<string, ParamUi>>>> = {
    "core.call-workflow": {
        agent: { input: "enum", options: ["sales", "accounting", "chatbot"] },
        workflow: LINE,
        version: LINE,
    },
    "core.for-each": { max: { input: "number", min: 1, max: 50 } },
    "core.outcome": { outcome: HIDDEN },
    "core.if": {
        op: { input: "enum", options: ["equals", "not-equals", "in", "present", "absent", "greater", "less"] },
        compare: LINE,
    },
    "sales.care-plan": { occasionLeadDays: OCCASION_LEAD },
    "sales.care-occasion": { occasionLeadDays: OCCASION_LEAD },
}

/** The currency sign of a `money` setting. */
export const MONEY_SIGN = "₫"

/** One choice of an `enum` setting. */
export interface ParamOption {
    /** The value stored in the setting. */
    readonly value: string
    /** The words the form shows. */
    readonly label: string
}

/** One setting of a node as a form draws it, with the value it holds now. */
export interface ParamField {
    /** The key in the node's params. */
    readonly name: string
    /** The words above the input. */
    readonly label: string
    /** One line under the input. */
    readonly help: string
    /** How the owner edits it. */
    readonly input: ParamInput
    /** True when the form does not show it. */
    readonly hidden: boolean
    /** True when the node cannot run without it. */
    readonly required: boolean
    /** The unit a duration or number is stored in. */
    readonly unit?: ParamUnit
    /** The word for the unit in the language asked (hours, minutes, days), or the sign for money. */
    readonly unitLabel?: string
    /** The lowest value. */
    readonly min?: number
    /** The highest value. */
    readonly max?: number
    /** The choices of an `enum`, with their words. */
    readonly options?: ReadonlyArray<ParamOption>
    /** True for a text that runs over several lines. */
    readonly multiline?: boolean
    /** What the setting holds when the graph gives none; absent when it has no default. */
    readonly default?: unknown
    /** What the setting holds in this graph (the default when the graph gave none). */
    readonly value?: unknown
}

/** The JSON Schema facts of one setting that the form reads. */
interface Facts {
    readonly required: ReadonlySet<string>
    readonly properties: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

const UNITS: Readonly<Record<ParamUnit, string>> = {
    days: "nodeUnitDays",
    hours: "nodeUnitHours",
    minutes: "nodeUnitMinutes",
}

/** The numbers a schema bounds a setting with; a bound too wide to be sensible (a safe-integer cap) is no bound. */
const SENSIBLE = 1_000_000_000

const factsOf = (node: NodeDefinition): Facts => {
    const schema: Readonly<Record<string, unknown>> = z.toJSONSchema(node.params, {
        io: "input",
        unrepresentable: "any",
    })
    const properties: unknown = schema["properties"]
    const required: unknown = schema["required"]
    const entries =
        typeof properties === "object" && properties !== null
            ? Object.entries(properties).filter(
                  (entry): entry is [string, Readonly<Record<string, unknown>>] =>
                      typeof entry[1] === "object" && entry[1] !== null,
              )
            : []
    return {
        required: new Set(
            Array.isArray(required) ? required.filter((one): one is string => typeof one === "string") : [],
        ),
        properties: Object.fromEntries(entries),
    }
}

const numberOf = (value: unknown): number | undefined =>
    typeof value === "number" && Math.abs(value) < SENSIBLE ? value : undefined

/** The lowest value a schema allows: its minimum, or the next whole number above an exclusive one. */
const schemaMin = (facts: Readonly<Record<string, unknown>>, whole: boolean): number | undefined => {
    const exclusive = numberOf(facts["exclusiveMinimum"])
    if (exclusive !== undefined) return whole ? Math.floor(exclusive) + 1 : exclusive
    return numberOf(facts["minimum"])
}

const wordOf = (locale: NodeLocale, name: string): string => messageNamed(locale, name) ?? name

/** The words of a hidden or unlisted setting's absence: a field the schema has and the table does not describes itself as plain text. */
const FALLBACK: ParamUi = { input: "text" }

/** The word after a setting's input: the money sign, or the unit of a duration or a number in the language asked. */
const unitLabelOf = (ui: ParamUi, locale: NodeLocale): string | undefined => {
    if (ui.input === "money") return MONEY_SIGN
    return ui.unit === undefined ? undefined : wordOf(locale, UNITS[ui.unit])
}

const fieldOf = (
    node: NodeDefinition,
    name: string,
    facts: Facts,
    locale: NodeLocale,
    values: Readonly<Record<string, unknown>>,
): ParamField => {
    const ui = NODE_PARAMS_UI[node.id]?.[name] ?? FALLBACK
    const schema = facts.properties[name] ?? {}
    const base = `nodeParam${namePartOf(node.id)}${namePartOf(name)}`
    const whole = schema["type"] === "integer"
    const min = ui.min ?? schemaMin(schema, whole)
    const max = ui.max ?? numberOf(schema["maximum"])
    const unitLabel = unitLabelOf(ui, locale)
    const value = values[name] ?? schema["default"]
    return {
        name,
        label: wordOf(locale, `${base}Label`),
        help: messageNamed(locale, `${base}Help`) ?? "",
        input: ui.input,
        hidden: ui.hidden === true,
        required: facts.required.has(name),
        ...(ui.unit === undefined ? {} : { unit: ui.unit }),
        ...(unitLabel === undefined ? {} : { unitLabel }),
        ...(min === undefined || ui.input === "text" || ui.input === "enum" ? {} : { min }),
        ...(max === undefined || ui.input === "text" || ui.input === "enum" ? {} : { max }),
        ...(ui.options === undefined
            ? {}
            : {
                  options: ui.options.map((option): ParamOption => ({
                      value: option,
                      label: wordOf(locale, `${base}Option${namePartOf(option)}`),
                  })),
              }),
        ...(ui.multiline === true ? { multiline: true } : {}),
        ...(schema["default"] === undefined ? {} : { default: schema["default"] }),
        ...(value === undefined ? {} : { value }),
    }
}

/**
 * The settings of a node as a form draws them, in the order of its schema: label and help in the language asked, how to edit each, its
 * limits, the choices of an enum and the value it holds (`values`, else the schema's default). Hidden settings are listed with
 * `hidden: true` so a form can skip them but still send them back unchanged.
 */
export const paramFieldsOf = (
    node: NodeDefinition,
    locale: NodeLocale,
    values: Readonly<Record<string, unknown>> = {},
): ReadonlyArray<ParamField> => {
    const facts = factsOf(node)
    return Object.keys(facts.properties).map((name) => fieldOf(node, name, facts, locale, values))
}
