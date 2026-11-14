import { z } from "zod"
import { keyText, prose } from "../schema/bounded.schema"
import { jsonValue } from "../schema/json-value.schema"
import type { JsonValue, SpecText } from "../schema/schema.types"
import { TRIGGER_KEY_MEMBERS, isTriggerKeyPath, type TriggerKeyPath } from "./trigger-event"

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
    /**
     * On the `data` input of a workflow a `workflow.called` trigger wakes, only: the params a caller maps, one level (each a name, a type and
     * whether it is required), which the run reads as `trigger.data.<name>` (lane concept triggers rule 13: an event's own members live in
     * `data`). Absent on every other input.
     */
    readonly members?: ReadonlyArray<WorkflowInput> | undefined
}

/** The input contract of a workflow version. */
export interface WorkflowContract {
    /** The inputs, in the order the editor lists them. */
    readonly inputs: ReadonlyArray<WorkflowInput>
}

/** The `data` input of a contract that declares its members (a workflow a `workflow.called` trigger wakes), or undefined. */
const dataInputOf = (contract: WorkflowContract | undefined): WorkflowInput | undefined =>
    (contract?.inputs ?? []).find((input) => input.name === TRIGGER_DATA_MEMBER && input.members !== undefined)

/**
 * The inputs a hand-off maps for a workflow: the members of its `data` input when it declares them (a workflow a `workflow.called` trigger
 * wakes: the caller's params arrive as the event's `data`), else its inputs (a contract stored before the params moved under `data`).
 */
export const callInputsOf = (contract: WorkflowContract | undefined): ReadonlyArray<WorkflowInput> =>
    dataInputOf(contract)?.members ?? contract?.inputs ?? []

// ---------------------------------------------------------------------------------------------------------------------------------
// Trigger sources
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Where a workflow is woken from: a customer channel (Zalo, Telegram, Facebook, Instagram, the website order form), the bank feed (SePay), a care timer, the
 * clock, a person in a group chat, another workflow's end hand-off, or a trigger a provider declares (`provider`: a bank movement, new
 * mail). Every kind arrives on the ONE event pipeline (lane concept `triggers` rule 13): the kind says only what the trigger scope's `data`
 * holds and which connection kind it listens on, never a road of its own.
 */
export type TriggerSourceKind =
    | "zalo"
    | "telegram"
    | "facebook"
    | "instagram"
    | "website"
    | "sepay"
    | "timer"
    | "schedule"
    | "chats-group"
    | "workflow"
    | "provider"

/** Every source kind, in the order the editor lists them. */
export const TRIGGER_SOURCE_KINDS: ReadonlyArray<TriggerSourceKind> = [
    "zalo",
    "telegram",
    "facebook",
    "instagram",
    "website",
    "sepay",
    "timer",
    "schedule",
    "chats-group",
    "workflow",
    "provider",
]

/** The kind of a source that registers on a provider's trigger. */
export const PROVIDER_SOURCE_KIND = "provider"

/**
 * The source of a trigger: its kind and the connection (channel account) it listens on; null listens on every one of the kind. A
 * source of kind `provider` also names the provider and the trigger it registers on (`sepay`, `transaction.received`); its filter is
 * the trigger's `conditions`, which may only compare the fields the provider declares as filterable.
 */
export interface TriggerSource {
    /** The kind. */
    readonly kind: TriggerSourceKind
    /** The connection id; null for any connection of the kind, and always null for a kind with no connection. */
    readonly connectionId: string | null
    /** Kind `provider` only: the provider key. */
    readonly provider?: string | undefined
    /** Kind `provider` only: the trigger name inside the provider. */
    readonly trigger?: string | undefined
}

/** The member of a wake's plain data that names the provider trigger it comes from, as `<provider>:<trigger>`. */
export const PROVIDER_TRIGGER_MEMBER = "providerTrigger"

/** `<provider>:<trigger>`: how a provider trigger is named in a wake. */
export const providerTriggerKeyOf = (provider: string, trigger: string): string => `${provider}:${trigger}`

/** The provider trigger a source registers on, as `<provider>:<trigger>`; null for any other source and for one that names none. */
export const providerTriggerOf = (source: TriggerSource): string | null =>
    source.kind === PROVIDER_SOURCE_KIND &&
    source.provider !== undefined &&
    source.provider !== "" &&
    source.trigger !== undefined &&
    source.trigger !== ""
        ? providerTriggerKeyOf(source.provider, source.trigger)
        : null

/** How a trigger condition compares a param of the wake; `in`: equal to one member of the list `value` (exact, never a substring). */
export type TriggerConditionOp = "equals" | "not-equals" | "in" | "contains" | "present"

/** One condition a wake must meet for the trigger to take it: a supplied param compared with a value. */
export interface TriggerCondition {
    /** The supplied param it reads. */
    readonly param: string
    /** How it compares. */
    readonly op: TriggerConditionOp
    /** What it compares with; absent for `present`. */
    readonly value?: JsonValue | undefined
}

/** One member of the event's `data` a verb declares: its name, its type, and whether it is an open flat record (a timer's own `data`). */
export interface DataMember {
    /** The name, as `trigger.data.<name>` reads it. */
    readonly name: string
    /** Its JSON type. */
    readonly type: ContractType
    /**
     * Set on an `object` member that is an OPEN flat record of text, numbers and yes/no (a timer's own `data`): a trigger `where` may then
     * name one key of it by the path `data.<member>.<key>` (exact equality on scalars only).
     */
    readonly open?: "scalars" | undefined
}

/** One param a source supplies at the top of the trigger scope: its name and type (and, on `data`, the members the verb declares in it). */
export interface SuppliedParam {
    /** The name, as `trigger.<name>` reads it. */
    readonly name: string
    /** Its JSON type. */
    readonly type: ContractType
    /**
     * Set on an `object` member that is an OPEN flat record of text, numbers and yes/no: a trigger `where` may name one key of it by the path
     * `<member>.<key>` (exact equality on scalars only). Absent: the member is no legal path head (but `data`, whose `members` say its paths).
     */
    readonly open?: "scalars" | undefined
    /** On `data` only: the members the verb declares in it; absent where no host told them (any `data.<member>` is then judged later). */
    readonly members?: ReadonlyArray<DataMember> | undefined
}

/** What the catalogue knows of a source kind: the connection kind it listens on and the params it supplies. */
export interface TriggerSourceInfo {
    /** The kind. */
    readonly kind: TriggerSourceKind
    /** The connection kind of its account (`zalo`, `telegram`, `sepay`); null for a kind with no connection. */
    readonly connectionKind: string | null
    /** The params it supplies; empty for `workflow`, which supplies exactly the contract its caller covers. */
    readonly supplies: ReadonlyArray<SuppliedParam>
}

/** The member of the trigger scope that holds the event's data. */
export const TRIGGER_DATA_MEMBER = "data"

/**
 * THE TRIGGER SCOPE (ROAD-API section 3.1, triggers rule 13): the generic members every verb supplies, nothing chat-specific. The check
 * `engine-business-contracts` compares this list with the triggers concept's table "Generic members of the trigger scope".
 */
export const TRIGGER_SCOPE: ReadonlyArray<SuppliedParam> = [
    // The event's id: the provider's own id of the event, or an engine source's once-key.
    { name: "eventId", type: "string" },
    // The connection of an account event.
    { name: "accountId", type: "string" },
    // The contact ENRICH met, and the route it ensured for the person on the account (or what an engine source already knew).
    { name: "contactId", type: "string" },
    { name: "routeId", type: "string" },
    // The event's own subject as the provider's translate gave it: a channel identity `{ channel, id, name?, picture? }`.
    { name: "subject", type: "object" },
    // The event's data, as the verb declares it.
    { name: TRIGGER_DATA_MEMBER, type: "object" },
    // The run's language.
    { name: "locale", type: "string" },
]

/** The generic members every event has: its id, its data and the run's language. */
const ALWAYS: ReadonlySet<string> = new Set(["eventId", TRIGGER_DATA_MEMBER, "locale"])

/** An event of a person on an account (a channel line, a website form): the account, the contact, the route and the subject ENRICH read. */
const PERSON_ON_ACCOUNT: ReadonlyArray<string> = ["accountId", "contactId", "routeId", "subject"]

/**
 * The trigger scope of a verb: the generic members it supplies (besides the id, the data and the language) in the scope's order, its `data`
 * holding the given members. A member a kind never fills is not supplied, so a contract that requires it is refused at save.
 */
const scopeWith = (
    members: ReadonlyArray<DataMember>,
    generic: ReadonlyArray<string> = [],
): ReadonlyArray<SuppliedParam> =>
    TRIGGER_SCOPE.filter((param) => ALWAYS.has(param.name) || generic.includes(param.name)).map((param) =>
        param.name === TRIGGER_DATA_MEMBER ? { ...param, members } : param,
    )

/**
 * The data of a customer channel's message, the four channels alike (ROAD-API 3.2): one event is ONE line; the other lines of a burst are the
 * run's queue. `resume` is set (`held`) only on the release door's event, which carries no words.
 */
const CHANNEL_DATA: ReadonlyArray<DataMember> = [
    { name: "messageKey", type: "string" },
    { name: "text", type: "string" },
    { name: "at", type: "string" },
    { name: "files", type: "array" },
    { name: "resume", type: "string" },
]

/**
 * The catalogue of trigger sources, by kind: the @1 vocabulary. The engine's trigger registry (`trigger-specs` of the back end) is the one
 * source of what each verb supplies per provider; this table stays for what a @1 document needs to be read and checked (a stored @1
 * graph): the connection kind of a kind and the scope it supplies (the generic members, its `data` declared per kind).
 */
export const TRIGGER_SOURCES: Readonly<Record<TriggerSourceKind, TriggerSourceInfo>> = {
    zalo: { kind: "zalo", connectionKind: "zalo", supplies: scopeWith(CHANNEL_DATA, PERSON_ON_ACCOUNT) },
    telegram: { kind: "telegram", connectionKind: "telegram", supplies: scopeWith(CHANNEL_DATA, PERSON_ON_ACCOUNT) },
    // The two channels of one Meta connection (a Page and its Instagram account): each its own kind, as a conversation names its channel.
    facebook: { kind: "facebook", connectionKind: "meta", supplies: scopeWith(CHANNEL_DATA, PERSON_ON_ACCOUNT) },
    instagram: { kind: "instagram", connectionKind: "meta", supplies: scopeWith(CHANNEL_DATA, PERSON_ON_ACCOUNT) },
    website: {
        kind: "website",
        connectionKind: null,
        supplies: scopeWith(
            [
                { name: "siteId", type: "string" },
                { name: "inboundEventId", type: "string" },
                { name: "request", type: "string" },
                { name: "contact", type: "object" },
            ],
            PERSON_ON_ACCOUNT,
        ),
    },
    sepay: {
        kind: "sepay",
        connectionKind: "sepay",
        supplies: scopeWith([{ name: "transactionId", type: "string" }], ["accountId"]),
    },
    timer: {
        kind: "timer",
        connectionKind: null,
        supplies: scopeWith(
            [
                // The timer's task row (its correlation key), the caller's key and the moment.
                { name: "taskId", type: "string" },
                { name: "ref", type: "string" },
                { name: "dueAt", type: "string" },
                { name: "careKind", type: "string" },
                { name: "suffix", type: "string" },
                // The item the timer is for (the occasion's id) and what the arm carries back (`data.data.shipWaits`): present only when given.
                { name: "item", type: "string" },
                { name: "data", type: "object", open: "scalars" },
                // The person: the contact and the route the arming run had, each when it had one.
            ],
            ["contactId", "routeId"],
        ),
    },
    schedule: { kind: "schedule", connectionKind: null, supplies: scopeWith([{ name: "slotMs", type: "integer" }]) },
    "chats-group": {
        kind: "chats-group",
        connectionKind: null,
        supplies: scopeWith([
            { name: "text", type: "string" },
            { name: "actorMemberId", type: "string" },
            { name: "threadId", type: "string" },
        ]),
    },
    workflow: { kind: "workflow", connectionKind: null, supplies: [] },
    // What it supplies is what the provider declares for the trigger it names: the host passes the declarations to the checks.
    provider: { kind: "provider", connectionKind: "provider", supplies: [] },
}

/** What a host tells the contract checks of one declared provider trigger. */
export interface ProviderTriggerInfo {
    /** The params a wake of the trigger supplies. */
    readonly supplies: ReadonlyArray<SuppliedParam>
    /** The names of the supplied params a filter may compare: closed choices only, never an id or a text. */
    readonly filterable: ReadonlyArray<string>
}

/** The declared provider triggers by `<provider>:<trigger>`, as the host that owns the providers knows them. */
export type ProviderTriggerLookup = (providerTrigger: string) => ProviderTriggerInfo | undefined

/** Whether a value of type `found` may fill an input of type `wanted`: the same type, or an integer where a number is wanted. */
export const contractTypeFits = (wanted: ContractType | "unknown", found: ContractType | "unknown"): boolean =>
    wanted === "unknown" || found === "unknown" || wanted === found || (wanted === "number" && found === "integer")

/** The generic members a call supplies besides its id, its data and the language: the caller's person and route. */
const CALLER_PERSON: ReadonlyArray<string> = ["contactId", "routeId"]

/**
 * The params a trigger supplies: its source's catalogue params; for a workflow hand-off the generic members with the callee's `data`
 * members (the params its caller maps), or the whole contract of one stored before the params moved under `data`; for a provider trigger
 * what the provider declares, or, where no host told the declarations (a package's own check, the editor), the whole contract, which
 * the host then judges when the workflow is saved.
 */
export const suppliedParamsOf = (
    source: TriggerSource,
    contract: WorkflowContract | undefined,
    declared?: ProviderTriggerLookup,
): ReadonlyArray<SuppliedParam> => {
    const whole = (): ReadonlyArray<SuppliedParam> =>
        (contract?.inputs ?? []).map((input) => ({ name: input.name, type: input.type }))
    if (source.kind === "workflow") {
        const members = dataInputOf(contract)?.members
        return members === undefined
            ? whole()
            : scopeWith(
                  members.map((member) => ({ name: member.name, type: member.type })),
                  CALLER_PERSON,
              )
    }
    if (source.kind !== PROVIDER_SOURCE_KIND) return TRIGGER_SOURCES[source.kind].supplies
    if (declared === undefined) return whole()
    return declared(providerTriggerOf(source) ?? "")?.supplies ?? []
}

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
    /** A provider source that names no provider or trigger, or another source that names one. */
    | "TRIGGER_PROVIDER_UNNAMED"
    /** A provider source that names a trigger no provider declares. */
    | "TRIGGER_PROVIDER_UNKNOWN"
    /** A filter of a provider trigger that compares a field the provider does not declare as filterable, or by containment. */
    | "TRIGGER_FILTER_INVALID"
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
 * Telegram all start "Tu van"), each supplying the full input contract; `trigger.channel` and `trigger.triggerKey` tell them apart.
 */
export interface WorkflowTrigger {
    /** The id of the trigger within its workflow, what `trigger.triggerKey` reads and save problems name. */
    readonly key: string
    /** Where it is woken from. */
    readonly source: TriggerSource
    /** What a wake must meet; none takes every wake of the source. */
    readonly conditions?: ReadonlyArray<TriggerCondition> | undefined
    /**
     * The registration's own correlation key (a generic member or `data.<member>`); absent: the verb's default. An event whose key value
     * matches a run of this workflow in flight goes onto that run's queue instead of starting a run (triggers rule 13, stage 5).
     */
    readonly correlationKey?: TriggerKeyPath | undefined
}

/**
 * The problems of a trigger's provider registration: a `provider` source names its provider and trigger (and no other kind names one),
 * the trigger is one the host knows when it told its declarations, and the filter compares only fields the provider declares as
 * filterable, by equality or presence: a payload holds ids, counts and closed choices, so no filter reads words.
 */
const providerProblems = (
    trigger: WorkflowTrigger,
    declared: ProviderTriggerLookup | undefined,
): ReadonlyArray<ContractProblem> => {
    const { source } = trigger
    const at = (member: string): string => `triggers.${trigger.key}.${member}`
    const named = source.provider !== undefined || source.trigger !== undefined
    if (source.kind !== PROVIDER_SOURCE_KIND)
        return named ? [{ code: "TRIGGER_PROVIDER_UNNAMED", at: at("source") }] : []
    const key = providerTriggerOf(source)
    if (key === null) return [{ code: "TRIGGER_PROVIDER_UNNAMED", at: at("source") }]
    const info = declared?.(key)
    if (declared !== undefined && info === undefined) return [{ code: "TRIGGER_PROVIDER_UNKNOWN", at: at("source") }]
    return (trigger.conditions ?? [])
        .filter(
            (condition) =>
                condition.op === "contains" || (info !== undefined && !info.filterable.includes(condition.param)),
        )
        .map((condition): ContractProblem => ({ code: "TRIGGER_FILTER_INVALID", at: at(condition.param) }))
}

/** Whether a value is a JSON scalar (the only value an exact key into an open record compares). */
const isScalarValue = (value: unknown): boolean =>
    value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"

/** Whether a condition compares exactly on JSON scalars (`equals`, `in`, `present`): what a key into an open record allows. */
const exactOnScalars = (condition: TriggerCondition): boolean => {
    if (condition.op === "present") return true
    if (condition.op === "equals") return isScalarValue(condition.value)
    return (
        condition.op === "in" &&
        Array.isArray(condition.value) &&
        condition.value.every((entry) => isScalarValue(entry))
    )
}

/**
 * Whether a path names something the trigger supplies (ROAD-API 3.1): a supplied member; `data.<member>` of a member the verb declares in
 * `data` (any member where no host told them); `data.<member>.<key>` of a data member that is an open flat record, or `<member>.<key>` of a
 * top member that is one, then only exactly on scalars. The `data.` prefix is the root of the event's own members, not a level.
 * `condition` is null for a correlation key (no comparison).
 */
const pathLegal = (
    path: string,
    condition: TriggerCondition | null,
    supplied: ReadonlyArray<SuppliedParam>,
): boolean => {
    const [head = "", member, key, ...rest] = path.split(PATH_SEPARATOR)
    if (rest.length > 0) return false
    const top = supplied.find((param) => param.name === head)
    if (top === undefined) return false
    if (member === undefined) return true
    const exact = condition === null || exactOnScalars(condition)
    if (head !== TRIGGER_DATA_MEMBER || (top.members === undefined && top.open !== undefined))
        return key === undefined && top.open !== undefined && exact
    if (top.members === undefined) return true
    const declared = top.members.find((one) => one.name === member)
    if (declared === undefined) return false
    return key === undefined || (declared.open !== undefined && exact)
}

/** The problems of one trigger against the workflow's contract; `at` is `triggers.<key>.<member>`. */
const oneTriggerProblems = (
    trigger: WorkflowTrigger,
    contract: WorkflowContract | undefined,
    declared: ProviderTriggerLookup | undefined,
): ReadonlyArray<ContractProblem> => {
    const { source } = trigger
    const info = TRIGGER_SOURCES[source.kind]
    const suppliedList = suppliedParamsOf(source, contract, declared)
    const supplied = new Map(suppliedList.map((param) => [param.name, param.type]))
    // A provider trigger's filter reads the provider's payload, which only the host knows: judged when the host told it.
    const judged = !(source.kind === PROVIDER_SOURCE_KIND && declared === undefined)
    const at = (member: string): string => `triggers.${trigger.key}.${member}`
    return [
        ...providerProblems(trigger, declared),
        ...(contract?.inputs ?? []).flatMap((input): ReadonlyArray<ContractProblem> => {
            const found = supplied.get(input.name)
            if (found === undefined)
                return input.required ? [{ code: "TRIGGER_INPUT_UNSUPPLIED", at: at(input.name) }] : []
            return contractTypeFits(input.type, found) ? [] : [{ code: "TRIGGER_INPUT_TYPE", at: at(input.name) }]
        }),
        ...(source.connectionId !== null && info.connectionKind === null
            ? [{ code: "TRIGGER_CONNECTION_INVALID" as const, at: at("source") }]
            : []),
        ...(judged ? (trigger.conditions ?? []) : [])
            .filter((condition) => !pathLegal(condition.param, condition, suppliedList))
            .map((condition): ContractProblem => ({ code: "TRIGGER_CONDITION_UNKNOWN", at: at(condition.param) })),
        // The registration's own correlation key names a member the scope supplies (a generic one, or one of `data`).
        ...(judged &&
        trigger.correlationKey !== undefined &&
        !(isTriggerKeyPath(trigger.correlationKey) && pathLegal(trigger.correlationKey, null, suppliedList))
            ? [{ code: "TRIGGER_CONDITION_UNKNOWN" as const, at: at("correlationKey") }]
            : []),
    ]
}

/** The names that appear more than once, once each. */
const duplicatesOf = (names: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set(names.filter((name, index) => names.indexOf(name) !== index)),
]

/**
 * The problems of a workflow's triggers: each must supply every required input of the contract with a fitting type (a workflow with
 * several inputs runs the same steps from each), a connection is named only on a kind that has one, a condition and a registration's own
 * key read a supplied member, and keys are unique. Every kind arrives on the one event pipeline, so there is no road to agree with. A graph
 * with no `triggers` (from before contracts) is judged by nothing here. `declared` is the host's provider triggers: with it a registration
 * on a provider trigger is judged against what the provider declares; without it only its shape is.
 */
export const triggerProblems = (
    triggers: ReadonlyArray<WorkflowTrigger> | undefined,
    contract: WorkflowContract | undefined,
    declared?: ProviderTriggerLookup,
): ReadonlyArray<ContractProblem> => {
    if (triggers === undefined) return []
    return [
        ...duplicatesOf(triggers.map((trigger) => trigger.key)).map((key): ContractProblem => ({
            code: "TRIGGER_KEY_DUPLICATE",
            at: `triggers.${key}`,
        })),
        ...triggers.flatMap((trigger) => oneTriggerProblems(trigger, contract, declared)),
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

/** A named business end of a workflow ("Chot mua", "Khach khong mua") with the fields it hands on. Editable by the owner. */
export interface WorkflowOutcome {
    /** The id, what an end node names (`won`). */
    readonly key: string
    /** The id as words when the graph gives none (the key itself). */
    readonly label: string
    /** The outcome's words in both languages ("Đã trả" / "Paid"), from its outcome step's `label`; absent: `label`. */
    readonly title?: SpecText | undefined
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
        ...duplicatesOf((outcomes ?? []).map((outcome) => outcome.key)).map((key): ContractProblem => ({
            code: "OUTCOME_DUPLICATE",
            at: `outcomes.${key}`,
        })),
        ...(outcomes ?? []).flatMap((outcome) =>
            duplicatesOf(outcome.outputs.map((output) => output.name)).map((name): ContractProblem => ({
                code: "OUTCOME_DUPLICATE",
                at: `outcomes.${outcome.key}.${name}`,
            })),
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

/** A binding that reads another value: an object whose `$ref` is a text, with the value to use when that one is missing. */
interface RefBinding {
    /** The path of the value this binding reads. */
    readonly $ref: string
    /** The value used when the reference resolves to nothing. */
    readonly default?: unknown
}

/** A binding is a ref when it is an object with a `$ref` text. */
const isRefBinding = (binding: unknown): binding is RefBinding =>
    typeof binding === "object" &&
    binding !== null &&
    !Array.isArray(binding) &&
    typeof Reflect.get(binding, "$ref") === "string"

/** The ref a binding holds, or null when the binding is a plain value. */
const refOf = (binding: unknown): RefBinding | null => (isRefBinding(binding) ? binding : null)

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
              return { name, type: contractTypeOfValue(binding), mayBeEmpty: binding === null }
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
 * The problems of one hand-off's mapping against the target's contract (its call inputs, `callInputsOf`): each required input mapped (with a value that cannot read
 * nothing), no name the contract lacks, every type fitting. `at` is `<nodeKey>.<input>`.
 */
export const callProblems = (
    nodeKey: string,
    mapped: ReadonlyArray<MappedParam>,
    target: WorkflowContract,
): ReadonlyArray<ContractProblem> => {
    const byName = new Map(mapped.map((param) => [param.name, param]))
    const inputs = callInputsOf(target)
    const declared = new Map(inputs.map((input) => [input.name, input]))
    return [
        ...inputs
            .filter(
                (input) =>
                    input.required &&
                    (byName.get(input.name) === undefined || byName.get(input.name)?.mayBeEmpty === true),
            )
            .map((input): ContractProblem => ({ code: "CALL_INPUT_MISSING", at: `${nodeKey}.${input.name}` })),
        ...mapped.flatMap((param): ReadonlyArray<ContractProblem> => {
            const input = declared.get(param.name)
            if (input === undefined) return [{ code: "CALL_INPUT_UNKNOWN", at: `${nodeKey}.${param.name}` }]
            return contractTypeFits(input.type, param.type)
                ? []
                : [{ code: "CALL_INPUT_TYPE", at: `${nodeKey}.${param.name}` }]
        }),
    ]
}

/** The JSON type of a fixed value. */
export const contractTypeOfValue = (value: unknown): ContractType | "unknown" => {
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

/** A condition's param: a supplied member, or `<member>.<key>`, one key of a member that is an open flat record (`data.kind`). */
const conditionParam = keyText.regex(/^[a-z][a-zA-Z0-9]{0,63}(\.[A-Za-z][A-Za-z0-9_-]{0,63}){0,2}$/)

/** The zod schema of one input with no members (a member of `data`, or any input but `data`). */
const plainInputSchema = z.strictObject({
    name: inputName,
    type: z.enum(["string", "number", "integer", "boolean", "object", "array"]),
    required: z.boolean(),
})

/** The zod schema of an input contract: an input may carry its members one level deep (the `data` of a called workflow). */
export const workflowContractSchema: z.ZodType<WorkflowContract> = z.strictObject({
    inputs: z.array(plainInputSchema.extend({ members: z.array(plainInputSchema).max(40).optional() })).max(40),
})

/** The zod schema of a trigger source. */
export const triggerSourceSchema: z.ZodType<TriggerSource> = z.strictObject({
    kind: z.enum([
        "zalo",
        "telegram",
        "facebook",
        "instagram",
        "website",
        "sepay",
        "timer",
        "schedule",
        "chats-group",
        "workflow",
        "provider",
    ]),
    connectionId: keyText.min(1).nullable(),
    provider: keyText.regex(/^[a-z][a-z0-9_]{1,30}$/).optional(),
    trigger: keyText.regex(/^[a-z][a-z0-9.-]{1,60}$/).optional(),
})

/** The zod schema of a trigger condition. */
export const triggerConditionSchema: z.ZodType<TriggerCondition> = z.strictObject({
    param: conditionParam,
    op: z.enum(["equals", "not-equals", "in", "contains", "present"]),
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
            correlationKey: z
                .union([
                    z.enum(TRIGGER_KEY_MEMBERS),
                    z.templateLiteral(["data.", z.string().regex(/^[a-z][a-zA-Z0-9]{0,63}$/)]),
                ])
                .optional(),
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
            title: z.union([z.strictObject({ key: keyText.min(1) }), z.strictObject({ vi: prose, en: prose })]).optional(),
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
})

/** The separator of a condition param's path into an open record (`data.kind`). */
const PATH_SEPARATOR = "."

/**
 * The value a condition param names on a wake's scope: a plain member, or the path's keys one record after the other (`data.text`,
 * `data.data.kind`), as each record holds it; undefined where a step is no record or holds no such key (never read through the prototype).
 */
const paramValueOf = (params: Readonly<Record<string, unknown>>, param: string): unknown => {
    const [head = "", ...keys] = param.split(PATH_SEPARATOR)
    let value: unknown = Object.hasOwn(params, head) ? params[head] : undefined
    for (const key of keys) {
        if (typeof value !== "object" || value === null || Array.isArray(value) || !Object.hasOwn(value, key))
            return undefined
        value = Object.getOwnPropertyDescriptor(value, key)?.value
    }
    return value
}

/** Whether a wake's trigger params meet one condition. */
export const conditionHolds = (condition: TriggerCondition, params: Readonly<Record<string, unknown>>): boolean => {
    const value = paramValueOf(params, condition.param)
    switch (condition.op) {
        case "present":
            return value !== undefined && value !== null && value !== ""
        case "equals":
            return JSON.stringify(value ?? null) === JSON.stringify(condition.value ?? null)
        case "not-equals":
            return JSON.stringify(value ?? null) !== JSON.stringify(condition.value ?? null)
        case "in":
            return (
                Array.isArray(condition.value) &&
                condition.value.some((member) => JSON.stringify(member) === JSON.stringify(value ?? null))
            )
        case "contains":
            return typeof value === "string" && typeof condition.value === "string"
                ? value.toLowerCase().includes(condition.value.toLowerCase())
                : Array.isArray(value) &&
                      value.some((member) => JSON.stringify(member) === JSON.stringify(condition.value))
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

/**
 * The problems of the entry rule: none since the conversation hold went (R35: a waiting run takes the person's next line; `holdsConversation`
 * deleted, R43). R28 LEFTOVER held for ONE caller in the frozen fe (`fe/apps/web/src/modules/workflowSteps/workflowEdits.ts`): delete this
 * and that call in the fe pass.
 */
export const entryProblems = (
    _entry: WorkflowEntry | undefined,
    _contract: WorkflowContract | undefined,
): ReadonlyArray<ContractProblem> => []
