import {
    isFileRef,
    isParamRef,
    maskJson,
    paramRefsOf,
    parseRef,
    refTextOf,
    resolveRef,
    valueAt,
    type LeadMemorySnapshot,
    type ParamRef,
    type RefScope,
    type Sensitivity,
    type StepMemory,
} from "@nivo-lite/agent-sdk/node"
import type { RunParamView } from "@/modules/types"
import { madeFactsOf } from "./agentRuns.facts"
import { stepStatusOf } from "./agentRuns.format"
import { humanLabelOf } from "./agentRuns.graph"
import type { AgentRunStepWire, RunContext, RunStepStatus } from "./agentRuns.types"

/*
 * What the aside of a run shows for a step: the params it ran with (each name, the value it resolved to, where it came from), and what
 * it made. It reads them from the memory of the run through ONE seam, `RunMemorySource`:
 * - today the back end answers a step as flat `input` / `output` facts, and `wireMemoryOf` turns them into that shape;
 * - when the run query carries the memory (`StepMemory` per step, the snapshot of the lead: `memory.contracts.ts` of the agent SDK),
 *   only `wireMemoryOf` is replaced by a reader of it (`snapshotMemoryOf`); the views below do not change.
 * Refs resolve with the SDK's own `resolveRef`, so what the page shows is what the engine read; secrets and personal data are masked
 * with the SDK's `maskJson` (the nodes' declared `sensitive` members first, then the names that always hold one).
 */

/** What a run's refs resolve against, and what a step's declaration says is sensitive. */
export interface RunMemorySource {
    /** What woke the run: `trigger.*` refs read from it. */
    readonly trigger: unknown
    /** The outcome of each node of this run, by node key. */
    readonly steps: Readonly<Record<string, StepMemory>>
    /** The memory of the lead across workflows, or null while the read does not carry it. */
    readonly lead: LeadMemorySnapshot | null
    /** The namespace of the workflow of the run (`sales.consult`); `workflows.*` refs of the same workflow read through it. */
    readonly namespace: string
    /** The members of a node's output that hold a secret or personal data, as the node declared. */
    readonly sensitiveOf: (nodeKey: string) => Readonly<Record<string, Sensitivity>>
}

/** A JSON value, the type memory keeps outputs in. */
type Json = Parameters<typeof maskJson>[0]

/** Whether a value is an object with members. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether a value is JSON all the way down. */
const isJson = (value: unknown): value is Json => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true
    if (Array.isArray(value)) return value.every(isJson)
    return isRecord(value) && Object.values(value).every(isJson)
}

/** A value as JSON: what memory keeps, and what masking reads. */
const toJson = (value: unknown): Json => (isJson(value) ? value : null)

/** An id as the engine writes it: never shown as words. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A value shown for an absent one. */
const NONE = "—"

/** The longest text a value is shown at before it is cut. */
const VALUE_MAX = 240

/** The status of a step of the wire in the words of memory. */
const memoryStatusOf = (status: RunStepStatus): StepMemory["status"] => {
    if (status === "failed") return "failed"
    return status === "done" ? "done" : "passed_over"
}

/** A value of a fact as the engine stored it: a JSON text becomes the value, any other text stays text. */
const valueOfFact = (text: string): unknown => {
    const first = text.trim().charAt(0)
    if (first !== "{" && first !== "[") return text
    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

/** The object a list of flat facts stands for; a fact that holds nothing is left out. */
const objectOfFacts = (facts: ReadonlyArray<{ readonly key: string; readonly value: string }>): Record<string, unknown> =>
    Object.fromEntries(facts.filter((fact) => fact.value !== "").map((fact) => [fact.key, valueOfFact(fact.value)]))

/**
 * The memory of a run as the back end answers it today: the trigger is what the steps were given (the same on each), each step's output
 * is its stored facts, and a failed step carries its error code as the failure. Nothing is known about the lead yet, and no node
 * declares what is sensitive, so the names decide.
 */
export const wireMemoryOf = (steps: ReadonlyArray<AgentRunStepWire>, runId: string, namespace: string): RunMemorySource => {
    const first = steps[0]
    return {
        trigger: first === undefined ? {} : objectOfFacts(first.input),
        steps: Object.fromEntries(
            steps.map((step) => {
                const status = memoryStatusOf(stepStatusOf(step.status))
                return [
                    step.nodeKey,
                    {
                        status,
                        output: status === "done" ? toJson(objectOfFacts(madeFactsOf(step))) : null,
                        error:
                            status === "failed"
                                ? { code: step.errorCode ?? "", messageKey: "", message: "", fields: {} }
                                : null,
                        runId,
                        versionId: "",
                        at: step.startedAt ?? "",
                    } satisfies StepMemory,
                ]
            }),
        ),
        lead: null,
        namespace,
        sensitiveOf: () => ({}),
    }
}

/** The scope the refs of a step resolve against: this run's memory. */
const scopeOf = (memory: RunMemorySource): RefScope => ({
    trigger: memory.trigger,
    steps: memory.steps,
    namespace: memory.namespace,
    memory: memory.lead,
})

/**
 * A ref as the engine reads it. A ref of a graph from before memory names a node of the run directly (`<nodeKey>.<path>`): it is
 * read as that node's output, the way the engine did.
 */
const parsedOf = (ref: string, memory: RunMemorySource) => {
    const parsed = parseRef(ref)
    if (parsed !== null) return parsed
    const [source = "", ...path] = ref.split(".")
    return source in memory.steps ? parseRef(["steps", source, "output", ...path].join(".")) : null
}

/** The text a value is shown as: words for the plain ones, the JSON of a list or an object, a file by its name. */
const textOf = (value: unknown, context: RunContext): string => {
    if (value === undefined || value === null || value === "") return NONE
    if (typeof value === "boolean") return context.t(value ? "valueYes" : "valueNo")
    if (typeof value === "string" || typeof value === "number") return String(value)
    if (isFileRef(value)) return value.name ?? context.t("valueFile")
    const text = JSON.stringify(value)
    return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}…` : text
}

/** The name of a field in plain words: the label the runs know it by, else the words of its key. */
const nameOf = (key: string, context: RunContext): string =>
    context.has(`fact_${key}`) ? context.t(`fact_${key}`) : humanLabelOf(key)

/** What decides the words of a value: the entity it names, whether it is a bare id, and the value to show. */
interface ValueParts {
    readonly entity: { readonly label: string } | null
    readonly isBareId: boolean
    readonly shown: unknown
}

/** The words a value is drawn as: the name of its entity, the note for an id with no name, else the value itself. */
const valueTextOf = (parts: ValueParts, context: RunContext): string => {
    if (parts.entity !== null) return parts.entity.label
    return parts.isBareId ? context.t("valueEntityUnknown") : textOf(parts.shown, context)
}

/** One row: the value masked when it is sensitive, and whether it was. */
const rowOf = (
    id: string,
    key: string,
    value: unknown,
    source: string,
    declared: Readonly<Record<string, Sensitivity>>,
    context: RunContext,
): RunParamView => {
    const maskedRecord = maskJson(toJson({ [key]: value ?? null }), declared)
    const masked = isRecord(maskedRecord) ? maskedRecord[key] : undefined
    const isMasked = JSON.stringify(masked) !== JSON.stringify(value ?? null)
    const entity = typeof value === "string" && !isMasked ? context.entityOf?.(key, value) ?? null : null
    const isBareId = typeof value === "string" && UUID.test(value)
    return {
        id,
        name: nameOf(key, context),
        value: valueTextOf({ entity, isBareId, shown: isMasked ? masked : value }, context),
        source,
        isMasked,
        isMissing: value === undefined || value === null,
        raw: entity !== null || isBareId ? String(value) : "",
        href: entity?.href ?? "",
    }
}

/** The refs a binding holds, as the text the editor writes them in ("= trigger.leadId"), once each. */
const sourceOf = (field: string, binding: unknown): string => {
    const refs: ReadonlyArray<ParamRef> = paramRefsOf({ [field]: toJson(binding) }).map((entry) => entry.ref)
    return [...new Set(refs.map((entry) => refTextOf(entry)))].join(", ")
}

/** A binding with its legacy refs (`<nodeKey>.<path>`) written as the refs of memory, so one reader resolves them all. */
const normalised = (binding: unknown, memory: RunMemorySource): unknown => {
    if (isParamRef(binding)) {
        const parsed = parsedOf(binding.$ref, memory)
        if (parsed === null) return binding
        const path =
            parsed.root === "steps"
                ? ["steps", parsed.nodeKey ?? "", parsed.part ?? "output", ...parsed.path]
                : [parsed.root, ...parsed.path]
        return { ...binding, $ref: parsed.root === "workflows" ? binding.$ref : path.join(".") }
    }
    if (Array.isArray(binding)) return binding.map((member: unknown) => normalised(member, memory))
    if (typeof binding === "object" && binding !== null)
        return Object.fromEntries(Object.entries(binding).map(([name, member]) => [name, normalised(member, memory)]))
    return binding
}

/** The value a binding resolved to in this run: a ref read from memory (its default when it found nothing), a fixed value as written. */
const resolvedOf = (binding: unknown, memory: RunMemorySource): unknown => {
    if (isParamRef(binding)) {
        const parsed = parsedOf(binding.$ref, memory)
        const value = parsed === null ? undefined : resolveRef(parsed, scopeOf(memory))
        return value ?? binding.default
    }
    if (Array.isArray(binding)) return binding.map((member: unknown) => resolvedOf(member, memory))
    if (typeof binding === "object" && binding !== null)
        return Object.fromEntries(Object.entries(binding).map(([name, member]) => [name, resolvedOf(member, memory)]))
    return binding
}

/** What a step was given in this run when the workflow does not say (a run on a graph this page cannot read): its recorded input, each from the trigger. */
const recordedInputsOf = (step: AgentRunStepWire, memory: RunMemorySource, context: RunContext): ReadonlyArray<RunParamView> =>
    step.input
        .filter((fact) => fact.value !== "")
        .map((fact, index) =>
            rowOf(`${step.stepKey}:in:${String(index)}`, fact.key, valueOfFact(fact.value), `= trigger.${fact.key}`, memory.sensitiveOf(step.nodeKey), context),
        )

/**
 * The params the step ran with in this run: each field of the node as the workflow wrote it, with the value it resolved to and where it
 * came from ("= trigger.leadId", "= steps.order.output.orderNo", empty for a fixed value). A node the workflow does not describe shows
 * what the step recorded it was given.
 */
export const inputsOf = (
    bindings: Readonly<Record<string, unknown>>,
    step: AgentRunStepWire,
    memory: RunMemorySource,
    context: RunContext,
): ReadonlyArray<RunParamView> => {
    const fields = Object.entries(bindings)
    if (fields.length === 0) return recordedInputsOf(step, memory, context)
    return fields.map(([field, binding]) => {
        const bound = normalised(binding, memory)
        return rowOf(`${step.stepKey}:in:${field}`, field, resolvedOf(bound, memory), sourceOf(field, bound), {}, context)
    })
}

/** What the step made: each member of its output with its value, masked as the node declared; a failed step made nothing. */
export const outputsOf = (
    step: AgentRunStepWire,
    memory: RunMemorySource,
    context: RunContext,
): ReadonlyArray<RunParamView> => {
    const output = memory.steps[step.nodeKey]?.output
    if (output === undefined || output === null) return []
    const declared = memory.sensitiveOf(step.nodeKey)
    if (typeof output !== "object" || Array.isArray(output) || isFileRef(output))
        return [rowOf(`${step.stepKey}:out`, "result", output, "", declared, context)]
    return Object.entries(output)
        .filter(([, value]) => value !== null && value !== "")
        .map(([key, value]) => rowOf(`${step.stepKey}:out:${key}`, key, value, "", declared, context))
}

/** The member of the output of a step at a path, for the branch a condition took; undefined when it has none. */
export const outputAt = (memory: RunMemorySource, nodeKey: string, path: ReadonlyArray<string>): unknown =>
    valueAt(memory.steps[nodeKey]?.output, path)
