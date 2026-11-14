import { OUTCOME_STEP } from "../../node/memory.contracts"
import type { GraphSpec, GraphSpecNode } from "../graph-spec.types"
import {
    CALL_WORKFLOW_STEP,
    DEFAULT_ENTRY,
    LATEST_VERSION,
    TRIGGER_SOURCES,
    suppliedParamsOf,
    type ContractProblem,
    type ContractType,
    type EntryOpenTo,
    type TriggerCondition,
    type TriggerSourceKind,
    type WorkflowOutcome,
} from "../workflow-contract"

/*
 * The contract parts of a workflow (its inputs, triggers, outcomes, entry rule, end hand-offs and every param binding) as the editor,
 * the graph canvas and the agent Graph page draw them, in words. The structure is NIVO core and lives here; the WORDS are the
 * installed plugin's, handed in as `ContractWords` (the engine reads them from the installation, a package binds its own catalog).
 */

/** The languages the views speak. */
export type ViewLocale = "vi" | "en"

/** Where the words of the views come from: one lookup per kind of word, in a language. */
export interface ContractWords {
    /** The words of a trigger source kind. */
    readonly sourceLabel: (kind: TriggerSourceKind, locale: ViewLocale) => string
    /** The words of an entry rule. */
    readonly entryLabel: (openTo: EntryOpenTo, locale: ViewLocale) => string
    /** The words of a contract type. */
    readonly typeLabel: (type: ContractType, locale: ViewLocale) => string
    /** The words of a trigger condition operator. */
    readonly conditionWord: (op: TriggerCondition["op"], locale: ViewLocale) => string
    /** The words of ONE param name (never a dotted path), or undefined when the source has none. */
    readonly paramLabel: (name: string, locale: ViewLocale) => string | undefined
    /** The separator of a dotted param path worded member by member. */
    readonly pathSeparator: (locale: ViewLocale) => string
    /** The words of the latest version of a called workflow. */
    readonly versionLatest: (locale: ViewLocale) => string
    /** The words of a pinned version, with `{version}` where the number goes. */
    readonly versionPinned: (locale: ViewLocale) => string
    /** The words of a contract problem, with `{where}` and `{name}` where they go. */
    readonly problem: (code: ContractProblem["code"], locale: ViewLocale) => string
    /** The words of the agent (module key) a hand-off calls, or undefined when the source has none. */
    readonly agentLabel: (agent: string, locale: ViewLocale) => string | undefined
}

/** One param a trigger supplies, as a chip. */
export interface ParamChipView {
    /** The param's name in the contract. */
    readonly name: string
    /** The param's words in the reader's language, its name when the catalog has none. */
    readonly label: string
    /** The param's contract type. */
    readonly type: ContractType
    /** The contract type's words in the reader's language. */
    readonly typeLabel: string
}

/** One condition of a trigger, in words. */
export interface TriggerConditionView {
    /** The condition in the reader's language: the param, the operator and the value. */
    readonly label: string
}

/** One trigger of a workflow as its card draws it. */
export interface TriggerView {
    /** The trigger's key in the workflow. */
    readonly key: string
    /** The kind of source that wakes the workflow. */
    readonly sourceKind: TriggerSourceKind
    /** The source kind's words in the reader's language. */
    readonly sourceLabel: string
    /** The connected account the source listens on; null when it names none. */
    readonly connectionId: string | null
    /** Whether the source kind listens on a connection (so the editor offers the account select). */
    readonly hasConnection: boolean
    /** The conditions the source event must meet, in words. */
    readonly conditions: ReadonlyArray<TriggerConditionView>
    /** The params the source supplies that the workflow takes. */
    readonly params: ReadonlyArray<ParamChipView>
}

/** One outcome of a workflow. */
export interface OutcomeView {
    /** The outcome's key in the workflow. */
    readonly key: string
    /** The outcome's name as the owner wrote it. */
    readonly label: string
    /** The fields the outcome returns. */
    readonly outputs: ReadonlyArray<ParamChipView>
}

/** The entry rule in words. */
export interface EntryView {
    /** Which callers may start the workflow. */
    readonly openTo: EntryOpenTo
    /** The entry rule's words in the reader's language. */
    readonly label: string
}

/**
 * One param binding as a chip or a plain value: a ref is dynamic, written `= steps.order.output.id` and drawn as a pink chip; anything
 * else is fixed and drawn plain.
 */
export interface BindingView {
    /** The bound param's name. */
    readonly name: string
    /** The bound param's words in the reader's language. */
    readonly label: string
    /** `ref` for a dynamic value read from the run, `fixed` for a written value. */
    readonly kind: "ref" | "fixed"
    /** `= <ref>` for a ref, the value written out for a fixed one. */
    readonly text: string
    /** The ref without the `=`, for a ref; null for a fixed value. */
    readonly ref: string | null
    /** The default of a ref, written out; null when it has none or the binding is fixed. */
    readonly fallback: string | null
}

/** An end hand-off as its card draws it: the exact target and the param table. */
export interface CallView {
    /** The module key of the agent the hand-off calls. */
    readonly agent: string
    /** The called agent's words in the reader's language, its key when the source has none. */
    readonly agentLabel: string
    /** The key of the called workflow. */
    readonly workflow: string
    /** The target's name when known (the reader passes the names of the workspace's workflows), else the key. */
    readonly workflowLabel: string
    /** `latest` or the pinned number, as text. */
    readonly version: string
    /** The called version in the reader's language. */
    readonly versionLabel: string
    /** The inputs the hand-off passes, one binding each. */
    readonly params: ReadonlyArray<BindingView>
}

/** An outcome end as its card draws it. */
export interface OutcomeEndView {
    /** The key of the outcome the end reaches. */
    readonly key: string
    /** The outcome's name as the owner wrote it, its key when the workflow does not declare it. */
    readonly label: string
    /** The outcome fields the end fills, one binding each. */
    readonly bindings: ReadonlyArray<BindingView>
}

/** One hand-off of a workflow, for the agent Graph page: which outcome it follows and the target it calls. */
export interface CallEdgeView {
    /** The key of the hand-off node. */
    readonly nodeKey: string
    /** The outcome the hand-off follows; null when it follows none. */
    readonly outcome: string | null
    /** The module key of the agent the hand-off calls. */
    readonly agent: string
    /** The key of the called workflow. */
    readonly workflow: string
    /** `latest` or the pinned number, as text. */
    readonly version: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A dynamic binding: the ref it reads and the value it falls back on. */
interface BindingRef {
    readonly $ref: string
    readonly default?: unknown
}

const refOf = (binding: unknown): BindingRef | null =>
    isRecord(binding) && typeof binding.$ref === "string" ? { $ref: binding.$ref, default: binding.default } : null

/** A fixed value written out for the owner: words as they are, anything else as JSON. */
const written = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value ?? null))

/** The version a hand-off calls, as text. */
const versionTextOf = (version: unknown): string => (typeof version === "number" ? String(version) : LATEST_VERSION)

/**
 * Every hand-off of a workflow with the outcome it follows: the nearest outcome end before it, through other hand-offs (an outcome may
 * fan out to several calls); null when it follows none. Pure structure: it needs no words.
 */
export const callEdgesOf = (spec: GraphSpec): ReadonlyArray<CallEdgeView> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const before = new Map<string, string>()
    for (const node of spec.nodes) {
        const targets = [...(node.next === undefined ? [] : [node.next]), ...Object.values(node.routes ?? {})]
        for (const target of targets) if (!before.has(target)) before.set(target, node.key)
    }
    const outcomeBefore = (key: string): string | null => {
        const seen = new Set<string>()
        for (let at = before.get(key); at !== undefined && !seen.has(at); at = before.get(at)) {
            seen.add(at)
            const node = byKey.get(at)
            if (node === undefined) return null
            if (node.step === OUTCOME_STEP && isRecord(node.params) && typeof node.params.outcome === "string")
                return node.params.outcome
            if (node.step !== CALL_WORKFLOW_STEP) return null
        }
        return null
    }
    return spec.nodes.flatMap((node): ReadonlyArray<CallEdgeView> => {
        if (node.step !== CALL_WORKFLOW_STEP || !isRecord(node.params)) return []
        return [
            {
                nodeKey: node.key,
                outcome: outcomeBefore(node.key),
                agent: typeof node.params.agent === "string" ? node.params.agent : "",
                workflow: typeof node.params.workflow === "string" ? node.params.workflow : "",
                version: versionTextOf(node.params.version),
            },
        ]
    })
}

/** The step or trigger a problem is at, and the param it names (`triggers.zalo.leadId` gives zalo and leadId). */
interface ProblemPlace {
    readonly where: string
    readonly name: string
}

const placeOf = (at: string): ProblemPlace => {
    const parts = at.split(".")
    if (parts[0] === "triggers") return { where: parts[1] ?? "", name: parts.slice(2).join(".") }
    if (parts[0] === "contract" || parts[0] === "outcomes") return { where: parts.slice(1).join("."), name: parts.slice(1).join(".") }
    return { where: parts[0] ?? "", name: parts.slice(1).join(".") }
}

/** The contract views over one set of words. */
export interface ContractViews {
    /** The words of a param, its name when it has none; a dotted path is worded member by member (`paymentClaim.amountVnd`). */
    readonly paramLabelOf: (name: string, locale: ViewLocale) => string
    /** One binding as a chip (a ref) or a plain value. */
    readonly bindingViewOf: (name: string, binding: unknown, locale?: ViewLocale) => BindingView
    /** Every binding of a record, in its order. */
    readonly bindingViewsOf: (bindings: unknown, locale?: ViewLocale) => ReadonlyArray<BindingView>
    /** The triggers of a workflow; empty for a graph from before contracts. */
    readonly triggerViewsOf: (spec: GraphSpec, locale: ViewLocale) => ReadonlyArray<TriggerView>
    /** The outcomes of a workflow. */
    readonly outcomeViewsOf: (spec: GraphSpec, locale: ViewLocale) => ReadonlyArray<OutcomeView>
    /** The entry rule of a workflow, open to any caller when it names none. */
    readonly entryViewOf: (spec: GraphSpec, locale: ViewLocale) => EntryView
    /** The hand-off of an end node, or null for any other node. `names` gives the target workflows' names by `<agent>.<workflow>`. */
    readonly callViewOf: (
        node: GraphSpecNode,
        locale: ViewLocale,
        names?: Readonly<Record<string, string>>,
    ) => CallView | null
    /** The outcome an end node reaches, or null for any other node. */
    readonly outcomeEndViewOf: (node: GraphSpecNode, spec: GraphSpec, locale: ViewLocale) => OutcomeEndView | null
    /** One contract problem in the owner's words; the step key is replaced by `titles[key]` when the reader passes step titles. */
    readonly contractProblemText: (
        problem: ContractProblem,
        locale: ViewLocale,
        titles?: Readonly<Record<string, string>>,
    ) => string
}

/** The contract views, in the words of one source (the installation's, or a package's own catalog). */
export const contractViewsOf = (words: ContractWords): ContractViews => {
    const paramLabelOf = (name: string, locale: ViewLocale): string =>
        words.paramLabel(name, locale) ??
        name
            .split(".")
            .map((part) => words.paramLabel(part, locale) ?? part)
            .join(words.pathSeparator(locale))

    const bindingViewOf = (name: string, binding: unknown, locale: ViewLocale = "vi"): BindingView => {
        const ref = refOf(binding)
        const label = paramLabelOf(name, locale)
        if (ref === null) return { name, label, kind: "fixed", text: written(binding), ref: null, fallback: null }
        return {
            name,
            label,
            kind: "ref",
            text: `= ${ref.$ref}`,
            ref: ref.$ref,
            fallback: ref.default === undefined ? null : written(ref.default),
        }
    }

    const bindingViewsOf = (bindings: unknown, locale: ViewLocale = "vi"): ReadonlyArray<BindingView> =>
        isRecord(bindings) ? Object.entries(bindings).map(([name, binding]) => bindingViewOf(name, binding, locale)) : []

    const chipOf = (name: string, type: ContractType, locale: ViewLocale): ParamChipView => ({
        name,
        label: paramLabelOf(name, locale),
        type,
        typeLabel: words.typeLabel(type, locale),
    })

    /** The words of one trigger condition: the param, the operator and the value (`careKind contains "payment"`). */
    const conditionLabelOf = (condition: TriggerCondition, locale: ViewLocale): string => {
        const word = words.conditionWord(condition.op, locale)
        const param = paramLabelOf(condition.param, locale)
        return condition.op === "present" ? `${param} ${word}` : `${param} ${word} ${written(condition.value)}`
    }

    const triggerViewsOf = (spec: GraphSpec, locale: ViewLocale): ReadonlyArray<TriggerView> =>
        (spec.triggers ?? []).map((trigger) => ({
            key: trigger.key,
            sourceKind: trigger.source.kind,
            sourceLabel: words.sourceLabel(trigger.source.kind, locale),
            connectionId: trigger.source.connectionId,
            hasConnection: TRIGGER_SOURCES[trigger.source.kind].connectionKind !== null,
            conditions: (trigger.conditions ?? []).map((condition) => ({ label: conditionLabelOf(condition, locale) })),
            params: suppliedParamsOf(trigger.source, spec.contract)
                .filter(
                    (param) =>
                        spec.contract === undefined || spec.contract.inputs.some((one) => one.name === param.name),
                )
                .map((param) => chipOf(param.name, param.type, locale)),
        }))

    /** An outcome's words in the language: its `title` written in both languages, else its `label` (a catalogue key title reads as the label). */
    const outcomeWords = (outcome: WorkflowOutcome, locale: ViewLocale): string =>
        outcome.title === undefined || "key" in outcome.title ? outcome.label : outcome.title[locale]

    /** The words of the outcome `key` of a spec; its key when the spec declares no such outcome. */
    const outcomeOf = (spec: GraphSpec, key: string, locale: ViewLocale): string => {
        const outcome = spec.outcomes?.find((one) => one.key === key)
        return outcome === undefined ? key : outcomeWords(outcome, locale)
    }

    const outcomeViewsOf = (spec: GraphSpec, locale: ViewLocale): ReadonlyArray<OutcomeView> =>
        (spec.outcomes ?? []).map((outcome) => ({
            key: outcome.key,
            label: outcomeWords(outcome, locale),
            outputs: outcome.outputs.map((output) => chipOf(output.name, output.type, locale)),
        }))

    const entryViewOf = (spec: GraphSpec, locale: ViewLocale): EntryView => {
        const entry = spec.entry ?? DEFAULT_ENTRY
        return {
            openTo: entry.openTo,
            label: words.entryLabel(entry.openTo, locale),
        }
    }

    /** The words of the version a hand-off calls: the latest, or the pinned number. */
    const versionLabelOf = (version: string, locale: ViewLocale): string =>
        version === LATEST_VERSION ? words.versionLatest(locale) : words.versionPinned(locale).replace("{version}", version)

    const callViewOf = (
        node: GraphSpecNode,
        locale: ViewLocale,
        names: Readonly<Record<string, string>> = {},
    ): CallView | null => {
        if (node.step !== CALL_WORKFLOW_STEP || !isRecord(node.params)) return null
        const agent = typeof node.params.agent === "string" ? node.params.agent : ""
        const workflow = typeof node.params.workflow === "string" ? node.params.workflow : ""
        const version = versionTextOf(node.params.version)
        return {
            agent,
            agentLabel: words.agentLabel(agent, locale) ?? agent,
            workflow,
            workflowLabel: names[`${agent}.${workflow}`] ?? workflow,
            version,
            versionLabel: versionLabelOf(version, locale),
            params: bindingViewsOf(node.params.inputs, locale),
        }
    }

    const outcomeEndViewOf = (node: GraphSpecNode, spec: GraphSpec, locale: ViewLocale): OutcomeEndView | null => {
        if (node.step !== OUTCOME_STEP || !isRecord(node.params)) return null
        const key = typeof node.params.outcome === "string" ? node.params.outcome : ""
        return {
            key,
            label: outcomeOf(spec, key, locale),
            bindings: bindingViewsOf(node.params.outputs, locale),
        }
    }

    const contractProblemText = (
        problem: ContractProblem,
        locale: ViewLocale,
        titles: Readonly<Record<string, string>> = {},
    ): string => {
        const { where, name } = placeOf(problem.at)
        return words
            .problem(problem.code, locale)
            .replace("{where}", titles[where] ?? where)
            .replace("{name}", name === "" ? "" : paramLabelOf(name, locale))
    }

    return {
        paramLabelOf,
        bindingViewOf,
        bindingViewsOf,
        triggerViewsOf,
        outcomeViewsOf,
        entryViewOf,
        callViewOf,
        outcomeEndViewOf,
        contractProblemText,
    }
}
