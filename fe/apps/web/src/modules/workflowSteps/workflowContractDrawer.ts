import {
    CALL_WORKFLOW_STEP,
    TRIGGER_SOURCE_KINDS,
    type ContractProblem,
    type GraphSpec,
    type GraphSpecNode,
} from "@nivo-lite/agent-sdk/graph"
import {
    AGENT_LABELS,
    bindableFieldsOf,
    bindingViewOf,
    callViewOf,
    CONTRACT_TYPE_LABELS,
    contractProblemText,
    installed,
    nodeCardsOf,
    outputFieldsOf,
    paramLabelOf,
    type PickType,
    refChipTextOf,
    refOptionsOf,
    TRIGGER_SOURCE_LABELS,
    triggerViewsOf,
} from "@/modules/plugin-registry"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import type {
    StepBindingView,
    StepCallView,
    StepPickerView,
    StepTriggerView,
} from "@/modules/types"
import { TRIGGER_KEY } from "./workflowEdits"

/*
 * The contract parts of the step drawer, in words: the data params of a step with their bindings and the output picker, what the step
 * answers, the workflow's inputs on the trigger step, the target of a hand-off, the "Loi" branch and the picker of a new step's kind.
 * The words come from blocks-core; this only lays them out for the drawer.
 */

/** The two languages of the drawer. */
type DrawerLocale = "vi" | "en"

/** The words the contract parts need that are the app's own (the rest are blocks-core's). */
export interface ContractWords {
    readonly required: string
}

const typeLabelOf = (type: PickType, locale: DrawerLocale): string =>
    type === "unknown" || type === "null" ? "" : CONTRACT_TYPE_LABELS[type][locale]

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The problems at one place (`<nodeKey>.<name>`, or a trigger's), in the owner's words, joined. */
const problemsAt = (problems: ReadonlyArray<ContractProblem>, at: string, locale: DrawerLocale): string =>
    problems
        .filter((problem) => problem.at === at || problem.at.startsWith(`${at}.`))
        .map((problem) => contractProblemText(problem, locale))
        .join(" ")

/** The contract of the workflow a hand-off calls, from the template of that module and key; null when NIVO ships none. */
const targetContractOf = (agent: string, workflow: string): GraphSpec["contract"] | null => {
    const template = installed.templates.find((one) => one.id === `${agent}.${workflow}`)
    return template === undefined ? null : (latestTemplateVersion(template).graph.contract ?? null)
}

/** One data param a step binds: its name, label, type and whether it must be bound. */
interface BindingField {
    readonly name: string
    readonly label: string
    readonly type: PickType
    readonly required: boolean
}

/** The text of a bound param: a ref in words, a fixed null as a dash, any other value as it reads. */
const bindingTextOf = (
    spec: GraphSpec,
    node: GraphSpecNode,
    view: ReturnType<typeof bindingViewOf> | null,
    bound: unknown,
    locale: DrawerLocale,
): string => {
    if (view === null) return ""
    if (view.kind === "ref" && view.ref !== null) return refChipTextOf(spec, node.key, view.ref, locale)
    if (view.kind === "fixed" && bound === null) return "—"
    return view.text
}

/** One param as a row: its binding (ref chip, fixed, or empty), the refs that fit its type, and why it cannot be saved. */
const bindingRowOf = (
    spec: GraphSpec,
    node: GraphSpecNode,
    field: BindingField,
    bound: unknown,
    problems: ReadonlyArray<ContractProblem>,
    locale: DrawerLocale,
    words: ContractWords,
): StepBindingView => {
    const view = bound === undefined ? null : bindingViewOf(field.name, bound, locale)
    const short = field.name.split(".").at(-1) ?? field.name
    const missing = field.required && view === null ? words.required : ""
    return {
        name: field.name,
        label: field.label,
        typeLabel: typeLabelOf(field.type, locale),
        required: field.required,
        kind: view === null ? "empty" : view.kind,
        // A ref reads in words ("= Khach · Dau vao"), its path only on hover; a fixed null reads as a dash, never as "null".
        text: bindingTextOf(spec, node, view, bound, locale),
        ref: view?.ref ?? null,
        options: refOptionsOf(spec, node.key, locale, field.type).map((option) => ({
            id: option.ref,
            label: option.label,
            group: option.group,
        })),
        error: [missing, problemsAt(problems, `${node.key}.${short}`, locale)].filter((text) => text !== "").join(" "),
    }
}

/**
 * The data params of a step with their bindings. A hand-off's are the inputs of the workflow it calls (`inputs.<name>`), an outcome's
 * the outputs its outcome declares (`outputs.<name>`), any other step's the members of its input schema; the trigger has none.
 */
export const bindingRowsOf = (
    spec: GraphSpec,
    nodeKey: string,
    problems: ReadonlyArray<ContractProblem>,
    locale: DrawerLocale,
    words: ContractWords,
): ReadonlyArray<StepBindingView> => {
    const node = spec.nodes.find((entry) => entry.key === nodeKey)
    if (node === undefined) return []
    const params: Readonly<Record<string, unknown>> = node.params ?? {}
    const nestedOf = (member: string): Readonly<Record<string, unknown>> => {
        const inner = params[member]
        return isRecord(inner) ? inner : {}
    }
    const row = (
        field: BindingField,
        bound: unknown,
    ) => bindingRowOf(spec, node, field, bound, problems, locale, words)
    if (node.step === CALL_WORKFLOW_STEP) {
        const agent = typeof params.agent === "string" ? params.agent : ""
        const workflow = typeof params.workflow === "string" ? params.workflow : ""
        const inputs = nestedOf("inputs")
        const declared = targetContractOf(agent, workflow)?.inputs ?? []
        const names = [...new Set([...declared.map((input) => input.name), ...Object.keys(inputs)])]
        return names.map((name) => {
            const input = declared.find((one) => one.name === name)
            return row(
                { name: `inputs.${name}`, label: paramLabelOf(name, locale), type: input?.type ?? "unknown", required: input?.required ?? false },
                inputs[name],
            )
        })
    }
    if (node.step === "core.outcome") {
        const outputs = nestedOf("outputs")
        const declared = spec.outcomes?.find((outcome) => outcome.key === params.outcome)?.outputs ?? []
        return declared.map((output) =>
            row({ name: `outputs.${output.name}`, label: paramLabelOf(output.name, locale), type: output.type, required: true }, outputs[output.name]),
        )
    }
    return bindableFieldsOf(node.step, locale)
        .filter((field) => field.name !== "locale")
        // A param written as null is bound (to nothing, on purpose); only one the graph does not write is unbound.
        .map((field) => row(field, Object.hasOwn(params, field.name) ? params[field.name] : node.input?.[field.name]))
}

/** What a step answers, for the "Ra" group. */
export const outputRowsOf = (
    spec: GraphSpec,
    nodeKey: string,
    locale: DrawerLocale,
): ReadonlyArray<{ readonly name: string; readonly label: string; readonly typeLabel: string }> => {
    const node = spec.nodes.find((entry) => entry.key === nodeKey)
    if (node === undefined) return []
    if (node.step === "core.outcome") {
        const declared = spec.outcomes?.find((outcome) => outcome.key === node.params?.outcome)?.outputs ?? []
        return declared.map((output) => ({
            name: `out.${output.name}`,
            label: paramLabelOf(output.name, locale),
            typeLabel: typeLabelOf(output.type, locale),
        }))
    }
    return outputFieldsOf(node.step, locale).map((field) => ({
        name: field.name,
        label: field.label,
        typeLabel: typeLabelOf(field.type, locale),
    }))
}

/** The inputs of the workflow, on the trigger step: each with the "Nguon" select, its conditions and the params it supplies. */
export const triggerRowsOf = (
    spec: GraphSpec,
    nodeKey: string,
    problems: ReadonlyArray<ContractProblem>,
    locale: DrawerLocale,
): ReadonlyArray<StepTriggerView> =>
    nodeKey !== TRIGGER_KEY
        ? []
        : triggerViewsOf(spec, locale).map((trigger) => ({
              key: trigger.key,
              source: trigger.sourceKind,
              sourceOptions: TRIGGER_SOURCE_KINDS.map((kind) => ({ id: kind, label: TRIGGER_SOURCE_LABELS[kind][locale] })),
              conditions: trigger.conditions.map((condition) => condition.label),
              params: trigger.params.map((param) => ({ name: param.name, label: param.label })),
              error: [problemsAt(problems, `triggers.${trigger.key}`, locale), problemsAt(problems, "trigger.sources", locale)]
                  .filter((text) => text !== "")
                  .join(" "),
          }))

/** The target of a hand-off: the select of every workflow NIVO ships, by agent then name. */
export const callRowOf = (
    spec: GraphSpec,
    nodeKey: string,
    problems: ReadonlyArray<ContractProblem>,
    locale: DrawerLocale,
): StepCallView | null => {
    const node = spec.nodes.find((entry) => entry.key === nodeKey)
    const call = node === undefined ? null : callViewOf(node, locale)
    if (node === undefined || call === null) return null
    const options = installed.templates.map((template) => ({
        id: template.id,
        label: `${AGENT_LABELS[template.moduleKey]?.[locale] ?? template.moduleKey} · ${template.name[locale]}`,
    }))
    const target = `${call.agent}.${call.workflow}`
    return {
        target,
        targetLabel: options.find((option) => option.id === target)?.label ?? call.workflowLabel,
        targetOptions: options,
        versionLabel: call.versionLabel,
        error: problemsAt(problems, node.key, locale),
    }
}

/** The picker of a new step's kind: every node NIVO installs, by its card's title and line. */
export const pickerOf = (isOpen: boolean, locale: DrawerLocale): StepPickerView => ({
    isOpen,
    options: isOpen
        ? [...nodeCardsOf(locale).values()]
              .filter((card) => card.id !== TRIGGER_KEY && card.id !== "stop")
              .map((card) => ({ id: card.id, label: card.title, description: card.subtitle }))
        : [],
})
