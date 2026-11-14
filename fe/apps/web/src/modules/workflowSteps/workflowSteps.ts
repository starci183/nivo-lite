import { graphSpecSchema, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { type GraphNodeView, type GraphView, graphViewOfSpec, nodeCardsOf, type ParamField } from "@/modules/plugin-registry"
import { stepsFlowOf, stepsLegendOf, stepsStatusLabelsOf } from "@/modules/plugin-registry/client"
import type {
    StepBranchView,
    StepDrawerView,
    StepFieldInput,
    StepFieldUnit,
    StepFieldValue,
    StepFieldView,
    StepsMapView,
} from "@/modules/types"

import { dressedGraphOf, framedFlowOf, legendOf } from "./workflowMap"
import { bindingRowsOf, callRowOf, outputRowsOf, pickerOf, triggerRowsOf } from "./workflowContractDrawer"
import { localContractProblems } from "./workflowEdits"

/** The two languages the cards are written in. */
export type StepsLocale = "vi" | "en"

/** The language of a locale code: English for `en`, Vietnamese for the rest. */
export const stepsLocaleOf = (locale: string): StepsLocale => (locale === "en" ? "en" : "vi")

/** A graph read from JSON text or a parsed document; null for anything that is not a graph spec. */
export const specOf = (source: unknown): GraphSpec | null => {
    if (source === null || source === undefined) return null
    try {
        const value: unknown = typeof source === "string" ? JSON.parse(source) : source
        const parsed = graphSpecSchema.safeParse(value)
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

/**
 * The graph view of a spec in one language, with the trigger card first: every title, line, port and setting in words. The control
 * steps (condition, wait, loop, hand-back) carry the graph's own words; a wait is dressed with its events and time.
 */
export const graphOfSpec = (spec: GraphSpec | null, locale: StepsLocale): GraphView =>
    spec === null ? { nodes: [], edges: [] } : dressedGraphOf(graphViewOfSpec(spec, { locale, withTrigger: true }), locale)

/** The card map of a graph view: the step cards, the edges, the kind legend and the status words. */
export const stepsMapOf = (graph: GraphView, locale: StepsLocale): StepsMapView => {
    const flow = framedFlowOf(stepsFlowOf(graph, locale), graph, locale)
    return {
        nodes: flow.nodes,
        edges: flow.edges,
        legend: legendOf(stepsLegendOf(locale), flow.nodes, locale),
        statusLabels: stepsStatusLabelsOf(locale),
    }
}

/** A node key or node id in one comparable form: letters and digits only, lower case ("matchCode", "match-code" → "matchcode"). */
const squashed = (text: string): string => text.toLowerCase().replaceAll(/[^a-z0-9]/g, "")

/**
 * The card of a node known only by its key (a run on a graph version that is no longer the one read): the core node whose id ends in
 * the same words ("matchCode" → `payment.match-code`), as a graph node with its title, line, kind and icon; null when none matches.
 */
export const nodeOfKey = (key: string, locale: StepsLocale): GraphNodeView | null => {
    const wanted = squashed(key)
    const card = [...nodeCardsOf(locale).values()].find((one) => squashed(one.id.split(".").pop() ?? one.id) === wanted)
    return card === undefined
        ? null
        : {
              id: key,
              label: card.title,
              kind: card.kind,
              description: card.subtitle,
              step: card.id,
              title: card.title,
              subtitle: card.subtitle,
              icon: card.icon,
              heroicon: card.heroicon,
          }
}

/** A map with nothing on it, for the skeleton. */
export const EMPTY_STEPS_MAP: StepsMapView = {
    nodes: [],
    edges: [],
    legend: [],
    statusLabels: { done: "", running: "", failed: "", waiting: "", skipped: "" },
}

/** The words of the step drawer, resolved by the hook that owns the catalog. */
export interface StepWords {
    readonly fieldsTitle: string
    readonly branchesTitle: string
    readonly bindingsTitle: string
    readonly outputsTitle: string
    readonly triggersTitle: string
    readonly pickerTitle: string
    readonly refLabel: string
    readonly fixedLabel: string
    readonly sourceLabel: string
    readonly conditionsLabel: string
    readonly paramsLabel: string
    readonly targetLabel: string
    readonly noConditions: string
    readonly pickLabel: string
    readonly emptyNote: string
    readonly readOnlyNote: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly errorTitle: string
    readonly required: string
    /** The language of the words, which the blocks-core labels follow. */
    readonly locale: StepsLocale
    readonly save: (number: number) => string
    readonly min: (min: string) => string
    readonly max: (max: string) => string
    readonly range: (min: string, max: string) => string
    /** A number of a setting in the reader's language, through the app's formatter: money in dong, a duration with its unit. */
    readonly number: (value: number, input: StepFieldInput, unit: StepFieldUnit | undefined) => string
}

/** The settings the form holds, by name. */
export type StepForm = Readonly<Record<string, StepFieldValue>>

const UNITS: Readonly<Record<NonNullable<ParamField["unit"]>, StepFieldUnit>> = {
    minutes: "minute",
    hours: "hour",
    days: "day",
}

/** How a setting is edited: a text over several lines is a paragraph. */
const inputOf = (field: ParamField): StepFieldInput => {
    if (field.input === "text" && field.multiline === true) return "paragraph"
    return field.input
}

const isNumeric = (input: StepFieldInput): boolean => input === "money" || input === "duration" || input === "number"

/** A number setting as the form holds it: the number, or nothing. */
const numberValueOf = (value: unknown): StepFieldValue =>
    typeof value === "number" && Number.isFinite(value) ? value : null

/** A text or choice setting as the form holds it: its words, a value of another type written out, or empty. */
const textValueOf = (value: unknown): StepFieldValue => {
    if (typeof value === "string") return value
    return value === undefined || value === null ? "" : JSON.stringify(value)
}

/** How the form holds the value of each input. */
const VALUE_OF: Readonly<Record<StepFieldInput, (value: unknown) => StepFieldValue>> = {
    money: numberValueOf,
    duration: numberValueOf,
    number: numberValueOf,
    boolean: (value) => value === true,
    enum: textValueOf,
    text: textValueOf,
    paragraph: textValueOf,
}

/** A value as the form holds it, by the input that edits it. */
const formValueOf = (input: StepFieldInput, value: unknown): StepFieldValue => VALUE_OF[input](value)

/** The settings a node shows, hidden ones left out. */
const shownOf = (node: GraphNodeView | undefined): ReadonlyArray<ParamField> =>
    (node?.paramFields ?? []).filter((field) => !field.hidden)

/** The form of a node as it is now: each shown setting with the value the graph gives it. */
export const formOfNode = (node: GraphNodeView | undefined): StepForm =>
    Object.fromEntries(shownOf(node).map((field) => [field.name, formValueOf(inputOf(field), field.value)]))

/** Why a number cannot be saved: missing when required, below the lowest or above the highest; empty when it can. */
const numberErrorOf = (field: ParamField, value: StepFieldValue, words: StepWords): string => {
    if (typeof value !== "number") return field.required ? words.required : ""
    const input = inputOf(field)
    const unit = field.unit === undefined ? undefined : UNITS[field.unit]
    const say = (number: number): string => words.number(number, input, unit)
    const isOut = (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)
    if (!isOut) return ""
    if (field.min !== undefined && field.max !== undefined) return words.range(say(field.min), say(field.max))
    return field.min === undefined ? words.max(say(field.max ?? value)) : words.min(say(field.min))
}

/** Why a value cannot be saved; empty when it can. */
const errorOf = (field: ParamField, value: StepFieldValue, words: StepWords): string => {
    const input = inputOf(field)
    if (isNumeric(input)) return numberErrorOf(field, value, words)
    return input !== "boolean" && field.required && (value === null || value === "") ? words.required : ""
}

/** One shown setting as the drawer draws it, with the value the form holds and why it cannot be saved. */
const fieldViewOf = (field: ParamField, form: StepForm, words: StepWords): StepFieldView => {
    const input = inputOf(field)
    const value = form[field.name] ?? formValueOf(input, field.value)
    const unit = field.unit === undefined || input === "money" ? undefined : UNITS[field.unit]
    return {
        name: field.name,
        label: field.label,
        description: field.help,
        input,
        ...(unit === undefined ? {} : { unit }),
        ...(field.min === undefined ? {} : { min: field.min }),
        ...(field.max === undefined ? {} : { max: field.max }),
        options: (field.options ?? []).map((option) => ({ id: option.value, label: option.label })),
        value,
        error: errorOf(field, value, words),
    }
}

/** The branches of a condition: each output with the step it leads to. */
const branchesOf = (
    graph: GraphView,
    map: StepsMapView,
    nodeKey: string,
): ReadonlyArray<StepBranchView> => {
    const titles = new Map(map.nodes.map((node) => [node.id, node.label]))
    return graph.edges
        .filter((edge) => edge.from === nodeKey && edge.back !== true && (edge.label ?? "") !== "")
        .map((edge) => ({ id: edge.id, output: edge.label ?? "", step: titles.get(edge.to) ?? "" }))
}

/** The settings the form changed, by name, with their new values; empty when nothing changed. */
export const changesOf = (
    node: GraphNodeView | undefined,
    form: StepForm,
): Readonly<Record<string, StepFieldValue>> => {
    const start = formOfNode(node)
    return Object.fromEntries(
        Object.entries(form).filter(([name, value]) => JSON.stringify(start[name]) !== JSON.stringify(value)),
    )
}

/** The graph with one step's settings changed; every other step and setting stays as it was. */
export const patchedSpecOf = (
    spec: GraphSpec,
    nodeKey: string,
    changes: Readonly<Record<string, StepFieldValue>>,
): GraphSpec => ({
    ...spec,
    nodes: spec.nodes.map((node) =>
        node.key === nodeKey ? { ...node, params: { ...node.params, ...changes } } : node,
    ),
})

/** What the drawer of a step is drawn from: the graph, its map, the step, the form and where the save stands. */
export interface StepDrawerInput {
    /** The graph as the drawer edits it (the version read with the drawer's changes), or null while unread. */
    readonly spec: GraphSpec | null
    /** True while the picker of a new step's kind is open. */
    readonly isPicking: boolean
    /** True when the graph differs from the version read (a new step, a branch, a binding, a source, a target). */
    readonly isEdited: boolean
    readonly graph: GraphView
    readonly map: StepsMapView
    readonly nodeKey: string
    readonly form: StepForm
    readonly isReadOnly: boolean
    /** The number of the version a save makes. */
    readonly nextNumber: number
    readonly isSaving: boolean
    readonly error: string
}

/** The drawer of the open step: its title and line, the form of its shown settings, its branches and the save command. */
export const stepDrawerOf = (input: StepDrawerInput, words: StepWords): Omit<StepDrawerView, "runMode"> => {
    const node = input.graph.nodes.find((entry) => entry.id === input.nodeKey)
    const card = input.map.nodes.find((entry) => entry.id === input.nodeKey)
    const fields = shownOf(node).map((field) => fieldViewOf(field, input.form, words))
    const changed = input.isEdited || Object.keys(changesOf(node, input.form)).length > 0
    const locale = words.locale
    // A graph still loading, or a version from before contracts, has nothing of the contract to judge.
    const spec = input.spec ?? null
    const problems = spec === null ? [] : localContractProblems(spec)
    const contract = {
        bindings: spec === null ? [] : bindingRowsOf(spec, input.nodeKey, problems, locale, { required: words.required }),
        outputs: spec === null ? [] : outputRowsOf(spec, input.nodeKey, locale),
        triggers: spec === null ? [] : triggerRowsOf(spec, input.nodeKey, problems, locale),
        call: spec === null ? null : callRowOf(spec, input.nodeKey, problems, locale),
    }
    const contractValid =
        problems.length === 0 &&
        contract.bindings.every((binding) => binding.error === "") &&
        (contract.call?.error ?? "") === ""
    return {
        isOpen: node !== undefined || input.isPicking,
        bindingsTitle: words.bindingsTitle,
        bindings: contract.bindings,
        outputsTitle: words.outputsTitle,
        outputs: contract.outputs,
        triggersTitle: words.triggersTitle,
        triggers: contract.triggers,
        call: contract.call,
        pickerTitle: words.pickerTitle,
        picker: pickerOf(input.isPicking, locale),
        refLabel: words.refLabel,
        fixedLabel: words.fixedLabel,
        sourceLabel: words.sourceLabel,
        conditionsLabel: words.conditionsLabel,
        paramsLabel: words.paramsLabel,
        targetLabel: words.targetLabel,
        noConditions: words.noConditions,
        openKey: input.nodeKey,
        pickLabel: words.pickLabel,
        title: card?.label ?? node?.title ?? "",
        description: node?.subtitle ?? node?.description ?? "",
        fieldsTitle: words.fieldsTitle,
        fields,
        branchesTitle: words.branchesTitle,
        branches: node === undefined ? [] : branchesOf(input.graph, input.map, node.id),
        emptyNote: words.emptyNote,
        isReadOnly: input.isReadOnly,
        readOnlyNote: words.readOnlyNote,
        closeLabel: words.closeLabel,
        cancelLabel: words.cancelLabel,
        saveLabel: words.save(input.nextNumber),
        canSave:
            !input.isReadOnly && changed && contractValid && fields.every((field) => field.error === "") && !input.isSaving,
        isSaving: input.isSaving,
        errorTitle: words.errorTitle,
        error: input.error,
    }
}
