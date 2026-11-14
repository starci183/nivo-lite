import {
    PROVIDER_TRIGGER_MEMBER,
    TRIGGER_DATA_MEMBER,
    TRIGGER_SCOPE,
    providerTriggerKeyOf,
    type ProviderTriggerInfo,
    type SuppliedParam,
} from "@nivo-lite/agent-sdk/graph"
import { PROVIDER_TRIGGERS } from "./provider-triggers.catalogue"
import type {
    OptionalAgentId,
    OptionalTriggerDeclaration,
    ProviderEvent,
    ProviderTriggerDeclaration,
    ProviderWake,
    TriggerField,
    TriggerRole,
    WakeContext,
} from "./provider-triggers.contracts"

/** What the contract checks are told of a trigger, or undefined for a key no provider declares. */
export type OptionalTriggerInfo = ProviderTriggerInfo | undefined

/** What a tag of a trigger's wake says started it. */
export const PROVIDER_TRIGGER_TAG_SOURCE = "provider_trigger"

/** An id: a short text of letters, digits and the separators ids are written with; never a sentence. */
const ID = /^[A-Za-z0-9][A-Za-z0-9._:~-]{0,199}$/u

export { providerTriggerKeyOf }

/** The member of a wake's plain data that names the account the trigger fired on. */
const CONNECTION_MEMBER = "connectionId"

/** The member of a wake's plain data that names the agent's part: `decider` or `notice`. */
const ROLE_MEMBER = "role"

/** The declaration of a trigger, or null when the provider declares none of that name. */
export const declarationOf = (
    provider: string,
    trigger: string,
    declared: ReadonlyArray<ProviderTriggerDeclaration> = PROVIDER_TRIGGERS,
): OptionalTriggerDeclaration => declared.find((entry) => entry.provider === provider && entry.name === trigger) ?? null

/**
 * Whether an account's switch of a trigger is ON: the switch a person set (on or off) when the account holds one, else the declaration's
 * default (`onByDefault`: only a trigger that reports work NIVO itself requested, concept triggers rule 6a); off for no declaration.
 */
export const switchedOn = (
    held: { readonly enabled: boolean } | null | undefined,
    declaration: ProviderTriggerDeclaration | null | undefined,
): boolean => (held === null || held === undefined ? declaration?.onByDefault === true : held.enabled)

/**
 * Whether a trigger NAME is on by default for every provider that declares it (`isOn` is asked by name only): true only when it is
 * declared and every declaration of the name says `onByDefault`.
 */
export const onByDefaultOf = (
    trigger: string,
    declared: ReadonlyArray<ProviderTriggerDeclaration> = PROVIDER_TRIGGERS,
): boolean => {
    const named = declared.filter((entry) => entry.name === trigger)
    return named.length > 0 && named.every((entry) => entry.onByDefault === true)
}

/** The triggers a provider declares. */
export const triggersOf = (
    provider: string,
    declared: ReadonlyArray<ProviderTriggerDeclaration> = PROVIDER_TRIGGERS,
): ReadonlyArray<ProviderTriggerDeclaration> => declared.filter((entry) => entry.provider === provider)

/** Whether a value is what the field declares: an id, a whole number that is not negative, or one of the closed choices. */
const fieldHolds = (field: TriggerField, value: unknown): boolean => {
    if (field.type === "id") return typeof value === "string" && ID.test(value)
    if (field.type === "integer") return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    return typeof value === "string" && (field.of ?? []).includes(value)
}

/**
 * The names of what is wrong with a payload against its declaration: a declared field that is absent or of another type, and any
 * member the declaration does not name. A payload carries exactly its declared fields, so no free text can ride in it.
 */
export const payloadProblems = (
    declaration: ProviderTriggerDeclaration,
    payload: Readonly<Record<string, unknown>>,
): ReadonlyArray<string> => {
    const declared = new Set(declaration.payload.map((field) => field.name))
    return [
        ...declaration.payload.filter((field) => !fieldHolds(field, payload[field.name])).map((field) => field.name),
        ...Object.keys(payload).filter((name) => !declared.has(name)),
    ]
}

/** One run a trigger would start: the events it carries and the wake it arrives as. */
export interface PlannedWake {
    /** The ids of the events it carries, in order. */
    readonly eventIds: ReadonlyArray<string>
    /** The wake. */
    readonly wake: ProviderWake
    /** The record the run is about (`<kind>:<id>`), when the declaration names one. */
    readonly subject: string | null
}

const sumOf = (events: ReadonlyArray<ProviderEvent>, field: string): number =>
    events.reduce((total, event) => total + (typeof event.payload[field] === "number" ? event.payload[field] : 0), 0)

const groupsOf = <Item>(items: ReadonlyArray<Item>, size: number): ReadonlyArray<ReadonlyArray<Item>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) => items.slice(index * size, (index + 1) * size))

/** The name of the count a `list` wake carries, and of the payload field it sums when the declaration has one. */
const COUNT = "count"

/**
 * The runs an emission would start, by the declaration's batching: `each` gives one per event, whose params are the event's payload;
 * `list` gives one per group of at most `maxEvents`, whose params are the event ids and a count (the sum of the events' `count` when
 * the payload declares one, else how many events).
 */
export const planWakes = (
    declaration: ProviderTriggerDeclaration,
    connectionId: string,
    events: ReadonlyArray<ProviderEvent>,
): ReadonlyArray<PlannedWake> => {
    const providerTrigger = providerTriggerKeyOf(declaration.provider, declaration.name)
    const { batching, subject } = declaration
    if (batching.mode === "each") {
        return events.map((event) => {
            const about = subject === undefined ? undefined : event.payload[subject.field]
            return {
                eventIds: [event.id],
                wake: { providerTrigger, connectionId, params: { ...event.payload } },
                subject: subject !== undefined && typeof about === "string" ? `${subject.kind}:${about}` : null,
            }
        })
    }
    const counted = declaration.payload.some((field) => field.name === COUNT)
    return groupsOf(events, Math.max(1, batching.maxEvents)).map((group) => {
        const eventIds = group.map((event) => event.id)
        return {
            eventIds,
            wake: {
                providerTrigger,
                connectionId,
                params: { eventIds, [COUNT]: counted ? sumOf(group, COUNT) : group.length },
            },
            subject: null,
        }
    })
}

/**
 * THE ONE DECIDER of an account's trigger. The agent the provider's own core path hands the event to decides while it is bound; with
 * none, the agent the owner bound on the switch; with neither, nobody decides and every receiver is told. It answers at most one
 * agent whatever it is given, so two deciders of one account trigger cannot exist.
 */
export const triggerDeciderOf = (
    declaration: ProviderTriggerDeclaration,
    coreDeciderId: OptionalAgentId,
    boundDeciderId: OptionalAgentId,
): OptionalAgentId => (declaration.decided ? (coreDeciderId ?? boundDeciderId) : null)

/** The plain data a trigger's wake hands the run: which trigger, on which account, the agent's part, and the params. */
export const wakeContextOf = (wake: ProviderWake, role: TriggerRole): WakeContext => ({
    ...wake.params,
    [PROVIDER_TRIGGER_MEMBER]: wake.providerTrigger,
    [CONNECTION_MEMBER]: wake.connectionId,
    [ROLE_MEMBER]: role,
})

/** The params every wake of a trigger supplies beside its own: the trigger, the account and the agent's part. */
const BASE_SUPPLIES: ReadonlyArray<SuppliedParam> = [
    { name: PROVIDER_TRIGGER_MEMBER, type: "string" },
    { name: CONNECTION_MEMBER, type: "string" },
    { name: ROLE_MEMBER, type: "string" },
]

/** The generic members an account event of the one pipeline supplies beside its `data`: its id, its account and the run's language. */
const ACCOUNT_EVENT_MEMBERS: ReadonlyArray<string> = ["eventId", "accountId", TRIGGER_DATA_MEMBER, "locale"]

/**
 * What a workflow that registers on a trigger is checked against: the params a wake supplies and the paths a filter may compare. An
 * `each` trigger's event reaches MATCH as the generic scope of the one pipeline (`deliver`): `eventId`, `accountId`, the run's language
 * and `data` holding the declared payload fields, so a filter names `data.<field>` of a closed choice the declaration marks filterable
 * (R44: the credit narrowing reads `data.direction`). A `list` wake supplies `eventIds` and `count` and filters on nothing.
 */
export const triggerInfoOf = (declaration: ProviderTriggerDeclaration): ProviderTriggerInfo => {
    if (declaration.batching.mode === "list") {
        return {
            supplies: [{ name: "eventIds", type: "array" }, { name: COUNT, type: "integer" }, ...BASE_SUPPLIES],
            filterable: [],
        }
    }
    const members = declaration.payload.map((field) => ({
        name: field.name,
        type: field.type === "integer" ? ("integer" as const) : ("string" as const),
    }))
    return {
        supplies: TRIGGER_SCOPE.filter((param) => ACCOUNT_EVENT_MEMBERS.includes(param.name)).map((param) =>
            param.name === TRIGGER_DATA_MEMBER ? { ...param, members } : param,
        ),
        filterable: declaration.payload
            .filter((field) => field.filterable && field.type === "choice")
            .map((field) => `${TRIGGER_DATA_MEMBER}.${field.name}`),
    }
}

/** The declared triggers as the workflow contract checks look them up, by `<provider>:<trigger>`. */
export const providerTriggerLookup = (providerTrigger: string): OptionalTriggerInfo => {
    const declaration = PROVIDER_TRIGGERS.find((entry) => providerTriggerKeyOf(entry.provider, entry.name) === providerTrigger)
    return declaration === undefined ? undefined : triggerInfoOf(declaration)
}
