import type { FileNotKept } from "@modules/domain/chat-files"
import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { isRecord } from "@modules/platform/primitives"
import type { CorrelationKey } from "./trigger-declaration.contracts"

/*
 * STAGES 3 AND 5 OF THE ONE EVENT PIPELINE, the pure part (lane concept triggers rule 13): the trigger scope an event gives a graph, the
 * correlation key that finds the run it belongs to, and the wake that carries it. Generic members only: the event's id, the account, the
 * person and the route the engine met, and the event's own data. Nothing here names a channel, a chat or a module.
 */

/** The wake source of every event of the pipeline: the producer names the verb in the wake itself (`verb`), never by its road. */
export const TRIGGER_WAKE_SOURCE = "trigger"

/** The lock scope of a wake whose registration has no key, or whose event holds no value for it: the agent's own (each event its own run). */
export const KEYLESS_SCOPE = "agent"

/** The prefix of the lock scope of a keyed wake: `key:<path>=<value>`. */
export const KEY_SCOPE_PREFIX = "key:"

/** The longest event id a delivery keeps (a provider's own id, or a source's once-key). */
export const EVENT_ID_MAX = 200

/** The member of the trigger scope that holds the event's own data (`trigger.data.*`). */
export const DATA_MEMBER = "data"

/** The member of an event's data that holds the files the entry kept for it. */
export const FILES_MEMBER = "files"

/** A file the entry kept in the shop's store for an event (the provider's address expires): what the run reads as `trigger.data.files`. */
export interface KeptFile {
    readonly id: string
    readonly url: string
    readonly name: string
    readonly contentType: string
    /** Why the entry could NOT keep this file (its typed reason): the person's stored line keeps it with no address. */
    readonly notKept?: FileNotKept | undefined
}

/** The generic trigger scope a graph refs as `trigger.*` (ROAD-API section 3.1). */
export type EventScope = {
    /** The event's id. */
    readonly eventId: string
    /** The account it came through, for an account event. */
    readonly accountId?: string | undefined
    /** The person: the contact ENRICH met, or the one an engine source names. */
    readonly contactId?: string | undefined
    /** The person's route on the account (ENRICH ensures it), or the one an engine source names. */
    readonly routeId?: string | undefined
    /** The event's data. */
    readonly data: Readonly<Record<string, unknown>>
}

/** A scope path of a correlation key: a generic member, or one member of the data (`data.<member>`). */
export type KeyPath = string

/**
 * The scope path a declaration's key names: the event's route for a key by its subject, the contact for a key by the person, one member
 * of the data, or none (every event its own run).
 */
export const keyPathOf = (key: CorrelationKey | { readonly by: "contact" }): KeyPath | null => {
    if (key.by === "subject") return "routeId"
    if (key.by === "contact") return "contactId"
    if (key.by === "data") return `${DATA_MEMBER}.${key.member}`
    return null
}

/** A scope path a registration may declare as its own key: a generic member, or `data.<member>`. */
const KEY_PATH = /^(?:routeId|contactId|accountId|eventId|data\.[A-Za-z][A-Za-z0-9_-]{0,63})$/u

/** The registration's own key when it declares a well-formed one, else null (then the declaration's key applies). */
export const ownKeyPathOf = (declared: unknown): KeyPath | null =>
    typeof declared === "string" && KEY_PATH.test(declared) ? declared : null

/** The value a scope holds at a key path, as text; null when it holds none (an empty text, or a value that is no scalar, is none). */
export const keyValueOf = (scope: EventScope, path: KeyPath): string | null => {
    const at = path.indexOf(".")
    const head: unknown = at < 0 ? Reflect.get(scope, path) : Reflect.get(scope, path.slice(0, at))
    const value: unknown = at < 0 ? head : isRecord(head) ? head[path.slice(at + 1)] : undefined
    if (typeof value === "string") return value === "" ? null : value
    return typeof value === "number" || typeof value === "boolean" ? String(value) : null
}

/** The lock scope of a wake: `key:<path>=<value>` for a keyed event, else the agent's own. */
export const scopeKeyOfEvent = (path: KeyPath | null, value: string | null): string =>
    path === null || value === null ? KEYLESS_SCOPE : `${KEY_SCOPE_PREFIX}${path}=${value}`

/** The once-key of an event's wake for one agent: the verb, where it came from (the account, else the agent) and the event's id. */
export const eventWakeKeyOf = (verb: TriggerVerb, origin: string, eventId: string): string => `${verb}:${origin}:${eventId}`

/** True for an event id a delivery takes: a text of 1 to `EVENT_ID_MAX` characters. */
export const eventIdHolds = (id: string): boolean => id !== "" && id.length <= EVENT_ID_MAX

/** The scope of an event: its id, the account, the person and route when known, and its data (with the kept files when there are any). */
export const eventScopeOf = (input: {
    readonly eventId: string
    readonly accountId: string | null
    readonly contactId: string | null
    readonly routeId: string | null
    readonly data: Readonly<Record<string, unknown>>
    readonly files: ReadonlyArray<KeptFile>
}): EventScope => ({
    eventId: input.eventId,
    ...(input.accountId === null ? {} : { accountId: input.accountId }),
    ...(input.contactId === null ? {} : { contactId: input.contactId }),
    ...(input.routeId === null ? {} : { routeId: input.routeId }),
    data: input.files.length === 0 ? input.data : { ...input.data, [FILES_MEMBER]: input.files },
})
