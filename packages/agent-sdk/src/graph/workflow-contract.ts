import { z } from "zod"
import { keyText } from "../schema/bounded.schema"
import { jsonValue } from "../schema/json-value.schema"
import type { JsonValue } from "../schema/schema.types"
import type { GraphTagSource } from "./graph-spec.types"

/*
 * The contracts of NIVO workflows (owner-approved law, 2026-11-09): every workflow version declares the inputs it needs; a trigger names
 * where it is woken from (a channel kind and the connection), the conditions it takes a wake on and, through its source, the params it
 * supplies; an end hand-off names the workflow it calls exactly and maps each of that workflow's inputs to a ref or a fixed value. A save
 * is refused when a source cannot supply the inputs, or a hand-off does not cover the target's contract with matching types.
 */

// ---------------------------------------------------------------------------------------------------------------------------------
// The input contract
// ---------------------------------------------------------------------------------------------------------------------------------

/** The JSON type of a contract input; the same words as the ref validator's `RefType`, without `null` and `unknown`. */
export type ContractType = "string" | "number" | "integer" | "boolean" | "object" | "array"

/** Every contract type, in the order the editor lists them. */
export const CONTRACT_TYPES: ReadonlyArray<ContractType> = ["string", "number", "integer", "boolean", "object", "array"]

/** One input a workflow version needs: its name (what `trigger.<name>` reads), its type and whether a run cannot start without it. */
export interface WorkflowInput {
    /** The name, a lower camel identifier: `leadId`, `orderId`, `text`. */
    readonly name: string
    /** The JSON type of the value. */
    readonly type: ContractType
    /** True when a caller must supply it; an optional input reads as null when not given. */
    readonly required: boolean
}

/** The input contract of a workflow version. */
export interface WorkflowContract {
    /** The inputs, in the order the editor lists them. */
    readonly inputs: ReadonlyArray<WorkflowInput>
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Trigger sources
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Where a workflow is woken from: a customer channel (Zalo, Telegram, the website order form), the bank feed (SePay), a care timer, the
 * clock, a person in a group chat, or another workflow's end hand-off.
 */
export type TriggerSourceKind = "zalo" | "telegram" | "website" | "sepay" | "timer" | "schedule" | "chats-group" | "workflow"

/** Every source kind, in the order the editor lists them. */
export const TRIGGER_SOURCE_KINDS: ReadonlyArray<TriggerSourceKind> = [
    "zalo",
    "telegram",
    "website",
    "sepay",
    "timer",
    "schedule",
    "chats-group",
    "workflow",
]

/** The source of a trigger: its kind and the connection (channel account) it listens on; null listens on every one of the kind. */
export interface TriggerSource {
    /** The kind. */
    readonly kind: TriggerSourceKind
    /** The connection id; null for any connection of the kind, and always null for a kind with no connection. */
    readonly connectionId: string | null
}

/** How a trigger condition compares a param of the wake. */
export type TriggerConditionOp = "equals" | "not-equals" | "contains" | "present"

/** One condition a wake must meet for the trigger to take it: a supplied param compared with a value. */
export interface TriggerCondition {
    /** The supplied param it reads. */
    readonly param: string
    /** How it compares. */
    readonly op: TriggerConditionOp
    /** What it compares with; absent for `present`. */
    readonly value?: JsonValue | undefined
}

/** One param a source supplies: its name and type. */
export interface SuppliedParam {
    /** The name, as `trigger.<name>` reads it. */
    readonly name: string
    /** Its JSON type. */
    readonly type: ContractType
}

/** What the catalogue knows of a source kind: the wake it arrives as, the connection kind it listens on and the params it supplies. */
export interface TriggerSourceInfo {
    /** The kind. */
    readonly kind: TriggerSourceKind
    /** The tag source its wakes arrive as, which routing reads. */
    readonly wake: GraphTagSource
    /** The connection kind of its account (`zalo`, `telegram`, `sepay`); null for a kind with no connection. */
    readonly connectionKind: string | null
    /** The params it supplies; empty for `workflow`, which supplies exactly the contract its caller covers. */
    readonly supplies: ReadonlyArray<SuppliedParam>
}

const CHANNEL_PARAMS: ReadonlyArray<SuppliedParam> = [
    { name: "conversationId", type: "string" },
    { name: "leadId", type: "string" },
    { name: "channel", type: "string" },
    { name: "text", type: "string" },
    { name: "messages", type: "array" },
    { name: "messageIds", type: "array" },
]

/** The catalogue of trigger sources, by kind. */
export const TRIGGER_SOURCES: Readonly<Record<TriggerSourceKind, TriggerSourceInfo>> = {
    zalo: { kind: "zalo", wake: "channel", connectionKind: "zalo", supplies: CHANNEL_PARAMS },
    telegram: { kind: "telegram", wake: "channel", connectionKind: "telegram", supplies: CHANNEL_PARAMS },
    website: {
        kind: "website",
        wake: "system-event",
        connectionKind: null,
        supplies: [
            { name: "leadId", type: "string" },
            { name: "request", type: "string" },
            { name: "contact", type: "object" },
        ],
    },
    sepay: {
        kind: "sepay",
        wake: "system-event",
        connectionKind: "sepay",
        supplies: [{ name: "transactionId", type: "string" }],
    },
    timer: {
        kind: "timer",
        wake: "system-event",
        connectionKind: null,
        supplies: [
            { name: "careKind", type: "string" },
            { name: "ref", type: "string" },
            { name: "suffix", type: "string" },
            { name: "dueAt", type: "string" },
        ],
    },
    schedule: {
        kind: "schedule",
        wake: "schedule",
        connectionKind: null,
        supplies: [{ name: "slotMs", type: "integer" }],
    },
    "chats-group": {
        kind: "chats-group",
        wake: "chats-group",
        connectionKind: null,
        supplies: [
            { name: "text", type: "string" },
            { name: "actorMemberId", type: "string" },
        ],
    },
    workflow: { kind: "workflow", wake: "agent", connectionKind: null, supplies: [] },
}

/** Whether a value of type `found` may fill an input of type `wanted`: the same type, or an integer where a number is wanted. */
export const contractTypeFits = (wanted: ContractType | "unknown", found: ContractType | "unknown"): boolean =>
    wanted === "unknown" || found === "unknown" || wanted === found || (wanted === "number" && found === "integer")

/** The params a trigger supplies: its source's catalogue params, or the whole contract for a workflow hand-off. */
export const suppliedParamsOf = (
    source: TriggerSource,
    contract: WorkflowContract | undefined,
): ReadonlyArray<SuppliedParam> =>
    source.kind === "workflow"
        ? (contract?.inputs ?? []).map((input) => ({ name: input.name, type: input.type }))
        : TRIGGER_SOURCES[source.kind].supplies

// ---------------------------------------------------------------------------------------------------------------------------------
// End hand-off
// ---------------------------------------------------------------------------------------------------------------------------------

/** The node step of an end hand-off: it calls another workflow, passing ONLY the params it maps. */
export const CALL_WORKFLOW_STEP = "core.call-workflow"

/**
 * The version a hand-off calls: a number pins one version, `latest` the one the target runs now. Seeds use `latest`, because a pin
 * silently freezes every later edit of the target; the safety a pin buys is kept by checking both sides: a caller is refused when it
 * does not cover the target's contract, and a target version is refused when it breaks the mapping of a caller that calls it as latest.
 */
export type CallVersion = number | "latest"

/** The words `latest` is written as. */
export const LATEST_VERSION = "latest"

/** The target of an end hand-off: the agent (by its module), the workflow (by key) and the version. */
export interface CallTarget {
    /** The module key of the agent that runs the workflow (`sales`): the agent of that role on the turn's channel. */
    readonly agent: string
    /** The key of the workflow within that agent (`consult`). */
    readonly workflow: string
    /** The version it calls. */
    readonly version: CallVersion
}

/** The pin a hand-off wake carries in its tag context, which routing honours. */
export interface WorkflowCallPin {
    /** The workflow key. */
    readonly workflow: string
    /** The version. */
    readonly version: CallVersion
}

/** The member of the tag context that holds the pin of a hand-off. */
export const WORKFLOW_CALL_MEMBER = "workflowCall"

/** The member of the tag context that holds the params a hand-off passes. */
export const WORKFLOW_PARAMS_MEMBER = "params"

/** One mapped value as the contract check sees it: its JSON type ("unknown" when a ref's type cannot be told). */
export interface MappedParam {
    /** The target input it fills. */
    readonly name: string
    /** The type of the value. */
    readonly type: ContractType | "unknown"
    /** True when the value is a ref with no default that may read nothing. */
    readonly mayBeEmpty: boolean
}

/** Why a trigger source or a hand-off is refused. */
export type ContractProblemCode =
    /** A required input the trigger's source does not supply. */
    | "TRIGGER_INPUT_UNSUPPLIED"
    /** An input the source supplies with another type. */
    | "TRIGGER_INPUT_TYPE"
    /** A connection named on a source kind that has none. */
    | "TRIGGER_CONNECTION_INVALID"
    /** A condition on a param the source does not supply. */
    | "TRIGGER_CONDITION_UNKNOWN"
    /** The wake envelope's `sources` are not exactly the wakes of the workflow's triggers. */
    | "TRIGGER_SOURCES_MISMATCH"
    /** Two triggers with one key. */
    | "TRIGGER_KEY_DUPLICATE"
    /** Two outcomes, or two outputs of one outcome, with one name. */
    | "OUTCOME_DUPLICATE"
    /** An end that names an outcome the workflow does not declare. */
    | "OUTCOME_UNKNOWN"
    /** An output of the outcome the end does not fill. */
    | "OUTCOME_OUTPUT_MISSING"
    /** A filled name the outcome does not declare. */
    | "OUTCOME_OUTPUT_UNKNOWN"
    /** A filled value whose type the output does not take. */
    | "OUTCOME_OUTPUT_TYPE"
    /** A call from another agent to a workflow whose entry is open to its own agent only. */
    | "CALL_ENTRY_CLOSED"
    /** A workflow that holds the conversation but whose contract does not require the conversation. */
    | "ENTRY_HOLD_WITHOUT_CONVERSATION"
    /** Two inputs of the contract with one name. */
    | "CONTRACT_INPUT_DUPLICATE"
    /** A hand-off to a workflow the workspace does not have. */
    | "CALL_TARGET_UNKNOWN"
    /** A hand-off pinned to a version the target does not have. */
    | "CALL_VERSION_UNKNOWN"
    /** A required input of the target the hand-off does not map. */
    | "CALL_INPUT_MISSING"
    /** A mapped name the target's contract does not declare. */
    | "CALL_INPUT_UNKNOWN"
    /** A mapped value whose type the target input does not take. */
    | "CALL_INPUT_TYPE"

/** One contract problem: why and where (`trigger`, `trigger.<param>`, `<nodeKey>.<input>`). */
export interface ContractProblem {
    /** Why. */
    readonly code: ContractProblemCode
    /** Where. */
    readonly at: string
}

/** The problems of a contract on its own: duplicate names. */
export const contractProblems = (contract: WorkflowContract | undefined): ReadonlyArray<ContractProblem> => {
    const names = (contract?.inputs ?? []).map((input) => input.name)
    return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))].map((name) => ({
        code: "CONTRACT_INPUT_DUPLICATE",
        at: `contract.${name}`,
    }))
}

/**
 * One input of a workflow: where it is woken from and the conditions it takes a wake on. A workflow may have several (Zalo, Facebook and
 * Telegram all start "Tư vấn"), each supplying the full input contract; `trigger.channel` and `trigger.triggerKey` tell them apart.
 */
export interface WorkflowTrigger {
    /** The id of the trigger within its workflow, what `trigger.triggerKey` reads and save problems name. */
    readonly key: string
    /** Where it is woken from. */
    readonly source: TriggerSource
    /** What a wake must meet; none takes every wake of the source. */
    readonly conditions?: ReadonlyArray<TriggerCondition> | undefined
}

/** The order the tag sources are listed in. */
const WAKE_ORDER: ReadonlyArray<GraphTagSource> = ["channel", "chats-group", "agent", "system-event", "schedule"]

/** The tag sources a set of triggers wakes on, in catalogue order, once each: what `GraphSpecTrigger.sources` must be. */
export const wakesOfTriggers = (triggers: ReadonlyArray<WorkflowTrigger>): ReadonlyArray<GraphTagSource> => {
    const wakes = new Set(triggers.map((trigger) => TRIGGER_SOURCES[trigger.source.kind].wake))
    return WAKE_ORDER.filter((wake) => wakes.has(wake))
}

/** The problems of one trigger against the workflow's contract; `at` is `triggers.<key>.<member>`. */
const oneTriggerProblems = (
    trigger: WorkflowTrigger,
    contract: WorkflowContract | undefined,
): ReadonlyArray<ContractProblem> => {
    const { source } = trigger
    const info = TRIGGER_SOURCES[source.kind]
    const supplied = new Map(suppliedParamsOf(source, contract).map((param) => [param.name, param.type]))
    const at = (member: string): string => `triggers.${trigger.key}.${member}`
    return [
        ...(contract?.inputs ?? []).flatMap((input): ReadonlyArray<ContractProblem> => {
            const found = supplied.get(input.name)
            if (found === undefined) return input.required ? [{ code: "TRIGGER_INPUT_UNSUPPLIED", at: at(input.name) }] : []
            return contractTypeFits(input.type, found) ? [] : [{ code: "TRIGGER_INPUT_TYPE", at: at(input.name) }]
        }),
        ...(source.connectionId !== null && info.connectionKind === null
            ? [{ code: "TRIGGER_CONNECTION_INVALID" as const, at: at("source") }]
            : []),
        ...(trigger.conditions ?? [])
            .filter((condition) => !supplied.has(condition.param))
            .map((condition): ContractProblem => ({ code: "TRIGGER_CONDITION_UNKNOWN", at: at(condition.param) })),
    ]
}

/** The names that appear more than once, once each. */
const duplicatesOf = (names: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set(names.filter((name, index) => names.indexOf(name) !== index)),
]

/**
 * The problems of a workflow's triggers: each must supply every required input of the contract with a fitting type (a workflow with
 * several inputs runs the same steps from each), a connection is named only on a kind that has one, a condition reads a supplied param,
 * keys are unique, and the wake envelope's `sources` are exactly the triggers' wakes. A graph with no `triggers` (from before contracts)
 * is judged by nothing here.
 */
export const triggerProblems = (
    triggers: ReadonlyArray<WorkflowTrigger> | undefined,
    sources: ReadonlyArray<GraphTagSource>,
    contract: WorkflowContract | undefined,
): ReadonlyArray<ContractProblem> => {
    if (triggers === undefined) return []
    const wakes = wakesOfTriggers(triggers)
    const sameWakes = wakes.length === new Set(sources).size && wakes.every((wake) => sources.includes(wake))
    return [
        ...duplicatesOf(triggers.map((trigger) => trigger.key)).map(
            (key): ContractProblem => ({ code: "TRIGGER_KEY_DUPLICATE", at: `triggers.${key}` }),
        ),
        ...triggers.flatMap((trigger) => oneTriggerProblems(trigger, contract)),
        ...(sameWakes ? [] : [{ code: "TRIGGER_SOURCES_MISMATCH" as const, at: "trigger.sources" }]),
    ]
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Outcomes (the OUT contract) and the entry rule
// ---------------------------------------------------------------------------------------------------------------------------------

/** One output field of an outcome. */
export interface OutcomeOutput {
    /** The name, what `out.<name>` reads. */
    readonly name: string
    /** Its JSON type. */
    readonly type: ContractType
}

/** A named business end of a workflow ("Chốt mua", "Khách không mua") with the fields it hands on. Editable by the owner. */
export interface WorkflowOutcome {
    /** The id, what an end node names (`won`). */
    readonly key: string
    /** The words the owner reads. */
    readonly label: string
    /** The fields every end on this outcome must fill. */
    readonly outputs: ReadonlyArray<OutcomeOutput>
}

/** The node step of an end on a named outcome: it fills the outcome's outputs, which the steps after it read as `out.<name>`. */
export { OUTCOME_STEP } from "../node/memory.contracts"

/** Who may call a workflow: any workflow of the workspace that supplies its inputs, or only the workflows of its own agent. */
export type EntryOpenTo = "any" | "agent"

/** The entry rule of a workflow. */
export interface WorkflowEntry {
    /** Who may call it. */
    readonly openTo: EntryOpenTo
    /**
     * True for a workflow that keeps the customer's conversation while it is open (the sales consult): the engine does not release the
     * conversation between its turns, and the customer's next lines go back to it instead of to the front desk.
     */
    readonly holdsConversation?: boolean | undefined
}

/** The entry rule a workflow without one has: open to any caller with the full params. */
export const DEFAULT_ENTRY: WorkflowEntry = { openTo: "any" }

/** What an outcome end node fills, as the check sees it. */
export interface OutcomeEnd {
    /** The node key. */
    readonly nodeKey: string
    /** The outcome it names. */
    readonly outcome: string
    /** The outputs it fills, typed. */
    readonly mapped: ReadonlyArray<MappedParam>
}

/**
 * The problems of the outcomes: unique keys and output names, every end naming a declared outcome and filling each of its outputs (no
 * more) with a fitting type. `at` is `outcomes.<key>[.<name>]` or `<nodeKey>.<name>`.
 */
export const outcomeProblems = (
    outcomes: ReadonlyArray<WorkflowOutcome> | undefined,
    ends: ReadonlyArray<OutcomeEnd>,
): ReadonlyArray<ContractProblem> => {
    const declared = new Map((outcomes ?? []).map((outcome) => [outcome.key, outcome]))
    return [
        ...duplicatesOf((outcomes ?? []).map((outcome) => outcome.key)).map(
            (key): ContractProblem => ({ code: "OUTCOME_DUPLICATE", at: `outcomes.${key}` }),
        ),
        ...(outcomes ?? []).flatMap((outcome) =>
            duplicatesOf(outcome.outputs.map((output) => output.name)).map(
                (name): ContractProblem => ({ code: "OUTCOME_DUPLICATE", at: `outcomes.${outcome.key}.${name}` }),
            ),
        ),
        ...ends.flatMap((end): ReadonlyArray<ContractProblem> => {
            const outcome = declared.get(end.outcome)
            // An undeclared outcome is the ref validator's OUTCOME_UNKNOWN; judged once, there.
            if (outcome === undefined) return []
            const asContract: WorkflowContract = {
                inputs: outcome.outputs.map((output) => ({ ...output, required: true })),
            }
            return callProblems(end.nodeKey, end.mapped, asContract).map((problem) => ({
                ...problem,
                code: OUTCOME_CODES[problem.code] ?? problem.code,
            }))
        }),
    ]
}

/** A binding is a ref when it is an object with a `$ref` text. */
const refOf = (binding: unknown): { readonly $ref: string; readonly default?: unknown } | null =>
    typeof binding === "object" && binding !== null && !Array.isArray(binding) && typeof Reflect.get(binding, "$ref") === "string"
        ? (binding as { readonly $ref: string; readonly default?: unknown })
        : null

/**
 * The mapped params of a record of bindings, as the contract checks see them: a fixed value typed by what it is; a ref typed by
 * `typeOfRef` (unknown when it cannot tell), and empty-able when it has no default and `mayReadNothing` says its source may hold nothing.
 */
export const mappedOf = (
    bindings: unknown,
    typeOfRef: (ref: string) => ContractType | "unknown" = () => "unknown",
): ReadonlyArray<MappedParam> =>
    typeof bindings === "object" && bindings !== null && !Array.isArray(bindings)
        ? Object.entries(bindings).map(([name, binding]: [string, unknown]): MappedParam => {
              const ref = refOf(binding)
              if (ref !== null) return { name, type: typeOfRef(ref.$ref), mayBeEmpty: false }
              return { name, type: contractTypeOfValue(binding as JsonValue), mayBeEmpty: binding === null }
          })
        : []

/** The outcome ends of a graph: every `core.outcome` node with the outcome it names and the outputs it fills. */
export const outcomeEndsOf = (
    nodes: ReadonlyArray<{ readonly key: string; readonly step: string; readonly params?: unknown }>,
): ReadonlyArray<OutcomeEnd> =>
    nodes.flatMap((node): ReadonlyArray<OutcomeEnd> => {
        if (node.step !== "core.outcome" || typeof node.params !== "object" || node.params === null) return []
        const outcome: unknown = Reflect.get(node.params, "outcome")
        return typeof outcome === "string"
            ? [{ nodeKey: node.key, outcome, mapped: mappedOf(Reflect.get(node.params, "outputs")) }]
            : []
    })

/** The outcome code of each hand-off code the outcome check reuses. */
const OUTCOME_CODES: Partial<Record<ContractProblemCode, ContractProblemCode>> = {
    CALL_INPUT_MISSING: "OUTCOME_OUTPUT_MISSING",
    CALL_INPUT_UNKNOWN: "OUTCOME_OUTPUT_UNKNOWN",
    CALL_INPUT_TYPE: "OUTCOME_OUTPUT_TYPE",
}

/**
 * The problems of one hand-off's mapping against the target's contract: each required input mapped (with a value that cannot read
 * nothing), no name the contract lacks, every type fitting. `at` is `<nodeKey>.<input>`.
 */
export const callProblems = (
    nodeKey: string,
    mapped: ReadonlyArray<MappedParam>,
    target: WorkflowContract,
): ReadonlyArray<ContractProblem> => {
    const byName = new Map(mapped.map((param) => [param.name, param]))
    const declared = new Map(target.inputs.map((input) => [input.name, input]))
    return [
        ...target.inputs
            .filter((input) => input.required && (byName.get(input.name) === undefined || byName.get(input.name)?.mayBeEmpty === true))
            .map((input): ContractProblem => ({ code: "CALL_INPUT_MISSING", at: `${nodeKey}.${input.name}` })),
        ...mapped.flatMap((param): ReadonlyArray<ContractProblem> => {
            const input = declared.get(param.name)
            if (input === undefined) return [{ code: "CALL_INPUT_UNKNOWN", at: `${nodeKey}.${param.name}` }]
            return contractTypeFits(input.type, param.type) ? [] : [{ code: "CALL_INPUT_TYPE", at: `${nodeKey}.${param.name}` }]
        }),
    ]
}

/** The JSON type of a fixed value. */
export const contractTypeOfValue = (value: JsonValue): ContractType | "unknown" => {
    if (value === null) return "unknown"
    if (Array.isArray(value)) return "array"
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
    if (typeof value === "string" || typeof value === "boolean") return typeof value === "string" ? "string" : "boolean"
    return "object"
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------------------------------

const inputName = keyText.regex(/^[a-z][a-zA-Z0-9]{0,63}$/)

/** The zod schema of an input contract. */
export const workflowContractSchema: z.ZodType<WorkflowContract> = z.strictObject({
    inputs: z
        .array(
            z.strictObject({
                name: inputName,
                type: z.enum(["string", "number", "integer", "boolean", "object", "array"]),
                required: z.boolean(),
            }),
        )
        .max(40),
})

/** The zod schema of a trigger source. */
export const triggerSourceSchema: z.ZodType<TriggerSource> = z.strictObject({
    kind: z.enum(["zalo", "telegram", "website", "sepay", "timer", "schedule", "chats-group", "workflow"]),
    connectionId: keyText.min(1).nullable(),
})

/** The zod schema of a trigger condition. */
export const triggerConditionSchema: z.ZodType<TriggerCondition> = z.strictObject({
    param: inputName,
    op: z.enum(["equals", "not-equals", "contains", "present"]),
    value: jsonValue.optional(),
})

/** The zod schema of the params of an end hand-off node. */
export const callTargetSchema: z.ZodType<CallTarget, CallTarget> = z.strictObject({
    agent: keyText.regex(/^[a-z][a-z0-9_]{1,23}$/),
    workflow: keyText.regex(/^[a-z][a-z0-9-]{0,63}$/),
    version: z.union([z.number().int().positive(), z.literal(LATEST_VERSION)]),
})

const slug = keyText.regex(/^[a-z][a-z0-9-]{0,63}$/)

/** The zod schema of the triggers of a workflow. */
export const workflowTriggersSchema: z.ZodType<ReadonlyArray<WorkflowTrigger>> = z
    .array(
        z.strictObject({
            key: slug,
            source: triggerSourceSchema,
            conditions: z.array(triggerConditionSchema).max(20).optional(),
        }),
    )
    .min(1)
    .max(10)

/** The zod schema of the outcomes of a workflow. */
export const workflowOutcomesSchema: z.ZodType<ReadonlyArray<WorkflowOutcome>> = z
    .array(
        z.strictObject({
            key: slug,
            label: keyText.min(1),
            outputs: z
                .array(
                    z.strictObject({
                        name: inputName,
                        type: z.enum(["string", "number", "integer", "boolean", "object", "array"]),
                    }),
                )
                .max(40),
        }),
    )
    .max(20)

/** The zod schema of the entry rule. */
export const workflowEntrySchema: z.ZodType<WorkflowEntry> = z.strictObject({
    openTo: z.enum(["any", "agent"]),
    holdsConversation: z.boolean().optional(),
})

/** Whether a wake's trigger params meet one condition. */
export const conditionHolds = (condition: TriggerCondition, params: Readonly<Record<string, unknown>>): boolean => {
    const value = params[condition.param]
    switch (condition.op) {
        case "present":
            return value !== undefined && value !== null && value !== ""
        case "equals":
            return JSON.stringify(value ?? null) === JSON.stringify(condition.value ?? null)
        case "not-equals":
            return JSON.stringify(value ?? null) !== JSON.stringify(condition.value ?? null)
        case "contains":
            return typeof value === "string" && typeof condition.value === "string"
                ? value.toLowerCase().includes(condition.value.toLowerCase())
                : Array.isArray(value) && value.some((member) => JSON.stringify(member) === JSON.stringify(condition.value))
    }
}

/** Whether a wake meets every condition of a trigger (none: it always does). */
export const conditionsHold = (
    conditions: ReadonlyArray<TriggerCondition> | undefined,
    params: Readonly<Record<string, unknown>>,
): boolean => (conditions ?? []).every((condition) => conditionHolds(condition, params))

/** The prefixes of the contract problem codes, which a save refuses with the contract's own words. */
const CONTRACT_PREFIXES: ReadonlyArray<string> = ["TRIGGER_", "CONTRACT_", "CALL_", "OUTCOME_", "ENTRY_"]

/** Whether a graph problem is a contract problem (a trigger, the input contract, a hand-off or an outcome). */
export const isContractProblem = (problem: { readonly code: string }): problem is ContractProblem =>
    CONTRACT_PREFIXES.some((prefix) => problem.code.startsWith(prefix))

/** The member of the input contract a workflow that holds the conversation must require. */
const CONVERSATION_INPUT = "conversationId"

/** The problems of the entry rule: a workflow that holds the conversation must require the conversation as an input. */
export const entryProblems = (
    entry: WorkflowEntry | undefined,
    contract: WorkflowContract | undefined,
): ReadonlyArray<ContractProblem> =>
    entry?.holdsConversation === true &&
    !(contract?.inputs ?? []).some((input) => input.name === CONVERSATION_INPUT && input.required && input.type === "string")
        ? [{ code: "ENTRY_HOLD_WITHOUT_CONVERSATION", at: "entry.holdsConversation" }]
        : []
