import {
    PROVIDER_SOURCE_KIND,
    PROVIDER_TRIGGER_MEMBER,
    providerTriggerKeyOf,
    providerTriggerOf,
    TRIGGER_DATA_MEMBER,
    type DataMember,
    type GraphTagSource,
    type SuppliedParam,
    type TriggerCondition,
    type TriggerSource,
} from "@nivo-lite/agent-sdk/graph"
import type { ProviderKey, TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { providerTriggerLookup } from "@modules/domain/provider-triggers"
import {
    ENGINE_ROAD,
    type OptionalProviderKey,
    type OptionalSourceProvider,
    type OptionalSourceRoad,
    type OptionalTriggerAdapterSpec,
    type OptionalTriggerSpec,
    type OptionalTriggerVerb,
    type TriggerAdapterSpec,
    type TriggerCarrier,
    type TriggerFields,
    type TriggerSpec,
    type WakeFacts,
    type WrappedProviderTrigger,
} from "./trigger-specs.contracts"
import { TRIGGERS } from "./trigger-specs.registry"

/** A text id of a scope member, or null. */
const idOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** Every spec of the registry, in verb order. */
const SPECS: ReadonlyArray<TriggerSpec> = Object.values(TRIGGERS)

/** The spec of a verb, or undefined for a string that is no verb of the registry. */
export const triggerSpecOf = (verb: string): OptionalTriggerSpec => SPECS.find((spec) => spec.verb === verb)

/**
 * What a source of `verb` supplies through `adapter`: what the adapter supplies (`suppliesOfAdapter`), with the members the verb DECLARES
 * of its stored row (`TriggerSpec.reads`) as members of the event's `data`, each once. One trigger pipeline: the delivered scope is
 * `eventId` / `accountId` / `data{...}` / `locale`, and the row's facts (a credit's amount, content, time, account, bank reference; a
 * render's output) arrive in `data` by the source's pure translate, never as top-level members (the flow fills nothing beside the data of
 * a pipeline event), so a graph reads them as `trigger.data.<member>`. A source that supplies no `data` gets none of them.
 */
export const suppliesOfVerb = (verb: string, adapter: TriggerAdapterSpec): ReadonlyArray<SuppliedParam> => {
    const own = suppliesOfAdapter(adapter)
    const fills = triggerSpecOf(verb)?.reads?.fills ?? []
    if (fills.length === 0) return own
    return own.map((param) => {
        if (param.name !== TRIGGER_DATA_MEMBER) return param
        const members = param.members ?? []
        const names = new Set(members.map((member) => member.name))
        const declared = fills
            .filter((fill) => !names.has(fill.name))
            .map((fill): DataMember => ({ name: fill.name, type: fill.type }))
        return { ...param, members: [...members, ...declared] }
    })
}

/**
 * The declared members of an event of `verb`, filled from the stored row's value its id names (`TriggerSpec.reads.fills`: member ←
 * field, as stored); a field the row does not hold (absent or null) leaves its member out. Empty for a verb that declares no read.
 */
export const declaredPayloadOf = (verb: string, row: TriggerFields): TriggerFields =>
    Object.fromEntries(
        (triggerSpecOf(verb)?.reads?.fills ?? []).flatMap((fill) => {
            const value = row[fill.field]
            return value === undefined || value === null ? [] : [[fill.name, value]]
        }),
    )

/** The subject of one event: the member of the trigger scope that names it (as the verb declares) and its value. */
export interface EventSubject {
    /** The supplied member. */
    readonly member: string
    /** Its value. */
    readonly id: string
}

/** An event subject, or null when the verb declares none. */
export type OptionalEventSubject = EventSubject | null

/**
 * The subject of an event of `verb` (`TriggerSpec.subject`: the first declared member the trigger scope holds as non-empty text), or
 * null for a verb that declares none, a verb the registry does not know, or a scope that holds none of its members.
 */
export const subjectOfEvent = (verb: string, trigger: TriggerFields): OptionalEventSubject => {
    // A generic member (`contactId`, `routeId`) is a top member of the scope; an event's own member is in its `data` (one pipeline).
    const data: unknown = trigger.data
    for (const member of triggerSpecOf(verb)?.subject ?? []) {
        const id = trigger[member] ?? (typeof data === "object" && data !== null ? Reflect.get(data, member) : undefined)
        if (typeof id === "string" && id !== "") return { member, id }
    }
    return null
}

/**
 * The adapters one trigger of a graph listens through: with providers named, the adapter of each in the order given (a provider that does
 * not serve the verb gives none); with none named, the verb's engine road (none for a verb only providers serve).
 */
export const adaptersOf = (
    verb: TriggerVerb,
    providers?: ReadonlyArray<ProviderKey>,
): ReadonlyArray<TriggerAdapterSpec> => {
    const spec = triggerSpecOf(verb)
    if (spec === undefined) return []
    if (providers === undefined || providers.length === 0) return spec.adapters.filter((adapter) => adapter.provider === ENGINE_ROAD)
    return providers.flatMap((provider) => spec.adapters.filter((adapter) => adapter.provider === provider))
}

/**
 * Who carries a verb's events (owner key `triggerOneSource2026_11_12`): `engine` for a verb the engine's own road serves (a trigger of it
 * names no account), `provider` for a verb only providers serve (a trigger of it lists at least one provider), `unknown` for no spec.
 */
export const triggerCarrierOf = (verb: string): TriggerCarrier => {
    const spec = triggerSpecOf(verb)
    if (spec === undefined) return "unknown"
    return spec.adapters.some((adapter) => adapter.provider === ENGINE_ROAD) ? "engine" : "provider"
}

/** The adapter of one provider (or, with none, of the engine road) of a verb; undefined where it does not serve the verb. */
export const adapterOf = (verb: TriggerVerb, provider: OptionalProviderKey): OptionalTriggerAdapterSpec =>
    adaptersOf(verb, provider === undefined ? undefined : [provider])[0]

/** The provider trigger a source of today registers on, as the registry names it, or null for a source of another kind. */
const wrappedOf = (source: TriggerSource): string | null => providerTriggerOf(source)

/** The adapter of the registry one source of the @1 envelope belongs to (a kind, or a provider trigger), or undefined for one it does not wrap. */
const adapterOfSource = (source: TriggerSource): TriggerAdapterSpec | undefined => {
    const wanted = wrappedOf(source)
    return SPECS.flatMap((spec) => spec.adapters).find((adapter) =>
        adapter.sources.some((own) =>
            wanted === null ? own.kind === source.kind && own.kind !== PROVIDER_SOURCE_KIND : wrappedOf(own) === wanted,
        ),
    )
}

/**
 * The provider whose adapter one source of today belongs to (a channel's provider, a provider trigger's provider), or null for a source
 * of the engine's own road or one the registry does not wrap: whose accounts the source is bound to.
 */
export const providerOfSource = (source: TriggerSource): OptionalSourceProvider => {
    const provider = adapterOfSource(source)?.provider
    return provider === undefined || provider === ENGINE_ROAD ? null : provider
}

/**
 * What one source supplies: a provider trigger what its provider declares (`providerTriggerLookup`: the payload of an `each` trigger
 * or `eventIds` / `count` of a `list` one, and the base members); any other kind what the registry's adapter of it supplies. A source
 * neither knows supplies nothing.
 */
export const suppliesOfSource = (source: TriggerSource): ReadonlyArray<SuppliedParam> => {
    if (source.kind === PROVIDER_SOURCE_KIND) {
        const wrapped = wrappedOf(source)
        return wrapped === null ? [] : (providerTriggerLookup(wrapped)?.supplies ?? [])
    }
    return adapterOfSource(source)?.supplies ?? []
}

/**
 * What one adapter SUPPLIES whichever of its sources brings the event: the registry's own members where it writes them (a channel, the
 * engine's road); for an adapter of provider triggers alone, the members every one of them
 * declares, with the type of the first.
 */
export const suppliesOfAdapter = (adapter: TriggerAdapterSpec): ReadonlyArray<SuppliedParam> => {
    if (adapter.supplies !== undefined) return adapter.supplies
    const [first, ...rest] = adapter.sources
    const others = rest.map((source) => new Set(suppliesOfSource(source).map((param) => param.name)))
    return suppliesOfSource(first).filter((param) => others.every((names) => names.has(param.name)))
}

/**
 * The road (`GraphTagSource`) the wakes of one source arrive on: a provider trigger's on `system-event` (the platform's one emit point);
 * any other kind's on its adapter's road. Null for a kind the registry does not wrap: such a source takes no wake.
 */
export const roadOfSource = (source: TriggerSource): OptionalSourceRoad => {
    if (source.kind === PROVIDER_SOURCE_KIND) return "system-event"
    return adapterOfSource(source)?.road ?? null
}

/** The provider triggers of today (adapter details: the switch's `trigger_name`) one adapter wraps, in its sources' order. */
export const wrappedTriggersOf = (adapter: TriggerAdapterSpec): ReadonlyArray<WrappedProviderTrigger> =>
    adapter.sources.flatMap((source): ReadonlyArray<WrappedProviderTrigger> => {
        if (source.kind !== PROVIDER_SOURCE_KIND || source.provider === undefined || source.trigger === undefined) return []
        return adapter.provider === ENGINE_ROAD ? [] : [{ provider: adapter.provider, name: source.trigger }]
    })

/** Whether one source of today is gated by an account's trigger switch: a provider trigger is; a channel and the engine are not. */
export const switchGated = (source: TriggerSource): boolean => source.kind === PROVIDER_SOURCE_KIND

/** The sources of today one trigger of a graph listens on (each once, in adapter order): what the derived envelope registers. */
export const sourcesOfTrigger = (
    verb: TriggerVerb,
    providers?: ReadonlyArray<ProviderKey>,
): ReadonlyArray<TriggerSource> => {
    const seen = new Set<string>()
    return adaptersOf(verb, providers)
        .flatMap((adapter) => adapter.sources)
        .filter((source) => {
            const key = providerTriggerOf(source) ?? source.kind
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
}

/**
 * The conditions a registration the engine derives for a verb on one source of today must carry so that it wakes on the verb's events only
 * (`narrows` of the adapter of the source's provider: a bank feed's `transaction.received` for `payment.credit.received` carries
 * `direction = in`); none for a source that carries exactly the verb (a channel, the engine's roads).
 */
export const conditionsOfSource = (verb: TriggerVerb, source: TriggerSource): ReadonlyArray<TriggerCondition> => {
    if (source.kind !== PROVIDER_SOURCE_KIND || source.provider === undefined || source.trigger === undefined) return []
    const adapter = triggerSpecOf(verb)?.adapters.find((one) => one.provider === source.provider)
    return adapter?.narrows?.find((narrowing) => narrowing.trigger === source.trigger)?.where ?? []
}

/** The verb a source of today is a source of (a kind, or a provider trigger), or null for a provider trigger the registry does not wrap. */
export const verbOfSource = (source: TriggerSource): OptionalTriggerVerb => {
    const adapter = adapterOfSource(source)
    return adapter === undefined ? null : (SPECS.find((one) => one.adapters.includes(adapter))?.verb ?? null)
}

/** The verb of a provider trigger (`<provider>:<trigger name>`, as a wake names it), or null for one the registry does not wrap. */
export const verbOfProviderTrigger = (key: string): OptionalTriggerVerb => {
    const spec = SPECS.find((one) =>
        one.adapters.some((adapter) => wrappedTriggersOf(adapter).some((wrapped) => providerTriggerKeyOf(wrapped.provider, wrapped.name) === key)),
    )
    return spec?.verb ?? null
}

/** True when one of the spec's sources (not a provider trigger) arrives on the road and, with a kind named, is of that kind. */
const arrivesOn = (spec: TriggerSpec, road: GraphTagSource, sourceKind: string | null): boolean =>
    spec.adapters.some(
        (adapter) =>
            adapter.road === road &&
            adapter.sources.some(
                (source) => source.kind !== PROVIDER_SOURCE_KIND && (sourceKind === null || source.kind === sourceKind),
            ),
    )

/**
 * The verb of a road that is no `system-event`: the one verb one of whose sources arrives on it. On a road several verbs arrive on
 * (`channel`: Zalo, Telegram, Facebook, Instagram), the verb whose source is of the wake's channel (`scope.channel`, the source kind the
 * customer intake writes on the wake); null where the wake names no channel or one no verb serves.
 */
const verbOfRoad = (road: GraphTagSource, scope: Readonly<Record<string, unknown>>): TriggerVerb | null => {
    const onRoad = SPECS.filter((one) => arrivesOn(one, road, null))
    const [only, second] = onRoad
    if (only === undefined) return null
    if (second === undefined) return only.verb
    const channel = idOf(scope.channel)
    if (channel === null) return null
    return onRoad.find((one) => arrivesOn(one, road, channel))?.verb ?? null
}

/**
 * THE VERB OF A WAKE, from the typed members its producer wrote: a road other than `system-event` names its verb (`channel` → the
 * channel's: `zalo.message.received`, `telegram.message.received`, `facebook.message.received`, `instagram.message.received`;
 * `schedule` → `clock.tick`, `chats-group` → `chat.message.received`, `agent` → `workflow.called`); on `system-event`, the provider
 * trigger the wake names (`providerTrigger`), else the system tag source it was tagged with (`source`: `website_lead` →
 * `website.message.received`, `care-timer` → `timer.due`). Null where neither names a verb (a plain task's or an internal event's wake,
 * another system's tag, a channel wake that names no channel or a channel no verb serves): such a wake is UNROUTABLE, it starts nothing
 * and the engine reports it (every wake carries a verb). The engine's own thread wakes (a decision, a deadline, a re-drive) are no trigger
 * wakes: they are told apart by their source and event (`FlowThreads.owns`) before any verb is asked.
 */
export const verbOfWake = (wake: WakeFacts): OptionalTriggerVerb => {
    if (wake.road !== "system-event") return verbOfRoad(wake.road, wake.scope)
    const fired = wake.scope[PROVIDER_TRIGGER_MEMBER]
    if (typeof fired === "string" && fired !== "") return verbOfProviderTrigger(fired)
    const tagged = wake.scope.source
    if (typeof tagged !== "string") return null
    return SPECS.find((one) => one.adapters.some((adapter) => adapter.tagSource === tagged))?.verb ?? null
}

/** The adapter a wake of a verb came through: by the provider trigger it names, else by its tag source, else the verb's only adapter. */
const adapterOfWake = (spec: TriggerSpec, wake: WakeFacts): TriggerAdapterSpec | undefined => {
    const fired = idOf(wake.scope[PROVIDER_TRIGGER_MEMBER])
    if (fired !== null) {
        return spec.adapters.find((adapter) =>
            wrappedTriggersOf(adapter).some((wrapped) => providerTriggerKeyOf(wrapped.provider, wrapped.name) === fired),
        )
    }
    const tagged = idOf(wake.scope.source)
    const byTag = tagged === null ? undefined : spec.adapters.find((adapter) => adapter.tagSource === tagged)
    return byTag ?? (spec.adapters.length === 1 ? spec.adapters[0] : undefined)
}

/**
 * THE NORMALISED EVENT KEY of a wake: what the one-run dedupe `(workflowId, eventKey)` keys on, the same for one event whichever road
 * brought it. A bank credit is `credit:<payment.transaction id>` (`transactionId`) whichever bank feed brought it;
 * a mail batch is `mail:<connection>:<first>..<last>#<count>` (one id: `mail:<connection>:<id>`); every other event reaches a graph by
 * one road and keeps the wake's own key. The wake's own key also where a member the rule reads is missing.
 */
export const eventKeyOf = (wake: WakeFacts & { readonly wakeEventKey: string }): string => {
    const verb = verbOfWake(wake)
    const spec = verb === null ? undefined : triggerSpecOf(verb)
    const adapter = spec === undefined ? undefined : adapterOfWake(spec, wake)
    const rule = adapter?.eventKey
    if (rule === undefined || rule.kind === "wake") return wake.wakeEventKey
    if (rule.kind === "record") {
        const id = idOf(wake.scope[rule.member])
        return id === null ? wake.wakeEventKey : `${rule.prefix}:${id}`
    }
    const ids = wake.scope[rule.member]
    const connection = idOf(wake.scope.connectionId)
    if (!Array.isArray(ids) || connection === null) return wake.wakeEventKey
    const listed = ids.filter((id): id is string => typeof id === "string" && id !== "")
    const [first] = listed
    if (first === undefined || listed.length !== ids.length) return wake.wakeEventKey
    const span = listed.length === 1 ? first : `${first}..${listed.at(-1) ?? first}#${listed.length}`
    return `${rule.prefix}:${connection}:${span}`
}
