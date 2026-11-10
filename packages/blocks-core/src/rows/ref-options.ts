import { LEAD_FACTS, OUTCOME_STEP } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { z } from "zod"
import { coreNodes } from "../nodes/core-nodes"
import { nodeTitleOf } from "../nodes/node-ui"
import type { NodeLocale } from "../nodes/node-schema.types"
import { paramLabelOf } from "./workflow-contract-view"

/*
 * What the output picker of the param drawer offers: for one step of a graph, the values a param may be bound to (`= trigger.text`,
 * `= steps.consult.output.items`, `= lead.address`, `= out.orderId`, `= steps.check.error.code`), each with its type and words, and the
 * params of the step that take a binding, typed. The save validator is the judge; this only offers what can be right.
 */

/** A JSON type as the picker compares them; `unknown` fits anything. */
export type PickType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null" | "unknown"

/** One value a param may be bound to. */
export interface RefOption {
    /** The ref, without the `=`. */
    readonly ref: string
    /** `= <ref>`, as the pink chip shows it. */
    readonly text: string
    /** The group the picker lists it under: the step's title, "Đầu vào", "Khách", "Kết quả". */
    readonly group: string
    /** The words of the value: "Tư vấn → Sản phẩm". */
    readonly label: string
    /** The words of the member alone ("Sản phẩm"), which the chip shows with its group: "= Sản phẩm · Tư vấn". */
    readonly field: string
    /** Its type. */
    readonly type: PickType
}

/** One param of a step that takes a binding (a ref or a fixed value). */
export interface BindableField {
    readonly name: string
    readonly label: string
    readonly type: PickType
    readonly required: boolean
}

type JsonSchemaObject = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is JsonSchemaObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const DEFINITIONS: ReadonlyMap<string, NodeDefinition> = new Map(coreNodes.map((node) => [node.id, node]))

/** The JSON Schema of a zod schema, or null when it cannot be drawn. */
const jsonOf = (schema: z.ZodType, io: "input" | "output"): JsonSchemaObject | null => {
    try {
        const json: unknown = z.toJSONSchema(schema, { io, unrepresentable: "any" })
        return isRecord(json) ? json : null
    } catch {
        return null
    }
}

/** The type of a JSON Schema: its `type` (the first that is not null), `unknown` when it names none. */
const typeOf = (schema: unknown): PickType => {
    if (!isRecord(schema)) return "unknown"
    const type = schema.type
    if (typeof type === "string") return isPickType(type) ? type : "unknown"
    if (Array.isArray(type)) {
        const first = type.find((one): one is string => typeof one === "string" && one !== "null")
        return first !== undefined && isPickType(first) ? first : "unknown"
    }
    const options = schema.anyOf ?? schema.oneOf
    if (Array.isArray(options)) {
        const typed = options.map(typeOf).filter((one) => one !== "null" && one !== "unknown")
        return typed[0] ?? "unknown"
    }
    return "unknown"
}

const PICK_TYPES: ReadonlyArray<PickType> = ["string", "number", "integer", "boolean", "object", "array", "null", "unknown"]
const isPickType = (text: string): text is PickType => PICK_TYPES.some((one) => one === text)

/** The properties of an object schema (looking through a nullable union), or none. */
const propertiesOf = (schema: unknown): ReadonlyArray<readonly [string, unknown]> => {
    if (!isRecord(schema)) return []
    if (isRecord(schema.properties)) return Object.entries(schema.properties)
    const options = schema.anyOf ?? schema.oneOf
    return Array.isArray(options) ? options.flatMap(propertiesOf) : []
}

const requiredOf = (schema: unknown): ReadonlySet<string> =>
    new Set(isRecord(schema) && Array.isArray(schema.required) ? schema.required.filter((one) => typeof one === "string") : [])

/** Whether a value of type `found` may fill a param of type `wanted`. */
export const pickTypeFits = (wanted: PickType, found: PickType): boolean =>
    wanted === "unknown" ||
    found === "unknown" ||
    wanted === found ||
    (wanted === "number" && found === "integer") ||
    found === "null"

/**
 * The data params of a step that take a binding: the members of its input schema (its settings are the form's), typed and worded. A
 * step this app does not install has none.
 */
export const bindableFieldsOf = (step: string, locale: NodeLocale): ReadonlyArray<BindableField> => {
    const definition = DEFINITIONS.get(step)
    const schema = definition === undefined ? null : jsonOf(definition.input, "input")
    const required = requiredOf(schema)
    return propertiesOf(schema).map(([name, member]) => ({
        name,
        label: paramLabelOf(name, locale),
        type: typeOf(member),
        required: required.has(name),
    }))
}

/** The members of a step's output, one level down into an object member: `items`, `paymentClaim.amountVnd`. */
const outputMembersOf = (step: string): ReadonlyArray<{ readonly path: string; readonly type: PickType }> => {
    const definition = DEFINITIONS.get(step)
    const schema = definition === undefined ? null : jsonOf(definition.output, "output")
    return propertiesOf(schema).flatMap(([name, member]) => {
        const top = { path: name, type: typeOf(member) }
        if (top.type !== "object") return [top]
        return [top, ...propertiesOf(member).map(([inner, value]) => ({ path: `${name}.${inner}`, type: typeOf(value) }))]
    })
}

/** The keys a node goes to: its next and every route. */
const edgesOf = (node: GraphSpecNode): ReadonlyArray<string> => [
    ...(node.next === undefined ? [] : [node.next]),
    ...Object.values(node.routes ?? {}),
]

/** The keys of the nodes from which the run can reach `key` (it excluded). */
const upstreamOf = (spec: GraphSpec, key: string): ReadonlySet<string> => {
    const before = new Map<string, Array<string>>()
    for (const node of spec.nodes) {
        for (const target of edgesOf(node)) before.set(target, [...(before.get(target) ?? []), node.key])
    }
    const seen = new Set<string>()
    const pending = [...(before.get(key) ?? [])]
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
        if (seen.has(at) || at === key) continue
        seen.add(at)
        pending.push(...(before.get(at) ?? []))
    }
    return seen
}

const WORDS: Readonly<Record<"inputs" | "lead" | "outcome", Readonly<Record<NodeLocale, string>>>> = {
    inputs: { vi: "Đầu vào", en: "Inputs" },
    lead: { vi: "Khách", en: "Customer" },
    outcome: { vi: "Kết quả", en: "Outcome" },
}

const option = (ref: string, group: string, label: string, type: PickType, field: string = label): RefOption => ({
    ref,
    text: `= ${ref}`,
    group,
    label,
    field,
    type,
})

/**
 * What a param of the step `nodeKey` may be bound to: the workflow's inputs (`trigger.*`, from its contract), the lead's facts
 * (`lead.*`), the outputs of every step that may run before it (`steps.<k>.output.*`), and the outputs of an outcome before it (`out.*`). When `type` is given, only what fits it.
 */
export const refOptionsOf = (
    spec: GraphSpec,
    nodeKey: string,
    locale: NodeLocale,
    type: PickType = "unknown",
): ReadonlyArray<RefOption> => {
    const upstream = spec.nodes.filter((node) => upstreamOf(spec, nodeKey).has(node.key))
    const inputs = (spec.contract?.inputs ?? []).map((input) =>
        option(`trigger.${input.name}`, WORDS.inputs[locale], paramLabelOf(input.name, locale), input.type),
    )
    const lead = LEAD_FACTS.map((fact) => option(`lead.${fact}`, WORDS.lead[locale], paramLabelOf(fact, locale), "unknown"))
    const outcomes = upstream
        .filter((node) => node.step === OUTCOME_STEP)
        .flatMap((node) => {
            const key: unknown = node.params?.outcome
            const outcome = spec.outcomes?.find((one) => one.key === key)
            return (outcome?.outputs ?? []).map((output) =>
                option(`out.${output.name}`, `${WORDS.outcome[locale]}: ${outcome?.label ?? ""}`, paramLabelOf(output.name, locale), output.type),
            )
        })
    const steps = upstream
        .filter((node) => node.step !== OUTCOME_STEP)
        .flatMap((node) => {
            const title = nodeTitleOf({ id: node.step }, locale)
            return outputMembersOf(node.step).map((member) =>
                option(
                    `steps.${node.key}.output.${member.path}`,
                    title,
                    `${title} → ${paramLabelOf(member.path, locale)}`,
                    member.type,
                    paramLabelOf(member.path, locale),
                ),
            )
        })
    return [...inputs, ...outcomes, ...steps, ...lead].filter((one) => pickTypeFits(type, one.type))
}

/** What a step answers, as the drawer's "Ra" group lists it: each member of its output, one level into objects, typed and worded. */
export const outputFieldsOf = (
    step: string,
    locale: NodeLocale,
): ReadonlyArray<{ readonly name: string; readonly label: string; readonly type: PickType }> =>
    outputMembersOf(step).map((member) => ({ name: member.path, label: paramLabelOf(member.path, locale), type: member.type }))

/**
 * The words of a ref as its chip shows them, `= <member> · <where>` ("= Khách · Đầu vào", "= Mã đơn · Ghi đơn từ chat"): from the picker's
 * option when it offers the ref, else worded from the ref itself (a deeper member, a ref this step may no longer read).
 */
export const refChipTextOf = (spec: GraphSpec, nodeKey: string, ref: string, locale: NodeLocale): string => {
    const offered = refOptionsOf(spec, nodeKey, locale).find((one) => one.ref === ref)
    if (offered !== undefined) return `= ${offered.field} · ${offered.group}`
    const [root = "", ...rest] = ref.split(".")
    if (root === "trigger") return `= ${paramLabelOf(rest.join("."), locale)} · ${WORDS.inputs[locale]}`
    if (root === "lead") return `= ${paramLabelOf(rest.join("."), locale)} · ${WORDS.lead[locale]}`
    if (root === "out") return `= ${paramLabelOf(rest.join("."), locale)} · ${WORDS.outcome[locale]}`
    if (root === "steps") {
        const [key = "", , ...path] = rest
        const step = spec.nodes.find((node) => node.key === key)?.step ?? key
        return `= ${paramLabelOf(path.join("."), locale)} · ${nodeTitleOf({ id: step }, locale)}`
    }
    return `= ${ref}`
}
