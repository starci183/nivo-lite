import type { DoorAnswer } from "./workbench-door.contracts"

/**
 * LEVEL 1 OF A PROVIDER: ITS API FOR THE INTERFACE. A provider has three levels: an API a person's screen calls, tools an agent calls
 * through the gateway, and triggers its background work emits. For the first it registers an `InterfaceReadProvider` (token
 * `INTERFACE_READ_PROVIDERS`): the current figures of an account (`info`) and its named reads (name, input schema, output schema,
 * shape) with their executor. ANY screen may call them: the provider's own page under the connections, the one-line summary of the
 * accounts list, an agent's workbench; one read, no per-provider web code. They are served by the person-read door of the platform
 * (this capability: the one door every read of a signed-in member goes through), which only proves the member, dispatches by
 * `<provider>:<read>`, asks the permission seam and audits; what a read reaches, how it pages and how its errors read are the
 * provider's own. A hand-written provider declares its reads in code (a bank provider: `transactions`, input `{ limit, cursor }`,
 * rows of bank movements, executed over its own store or API); the OpenAPI provider generates one read per selected GET operation.
 */

/** A label in the owner's two languages. */
export interface ProviderInfoLabel {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** One figure of an account's current state, as a generic account card draws it: a label and a value, no provider-specific code. */
export interface ProviderInfoFigure {
    /** The stable key of the figure inside the provider (`last_received`, `tools_ready`). */
    readonly key: string
    /** Its label in the owner's two languages. */
    readonly label: ProviderInfoLabel
    /** Its value: a count, a short text, or null when the provider does not know it yet. */
    readonly value: string | number | null
    /** `time`: the value is an ISO 8601 instant the card formats; `text` and `count` are drawn as they are. */
    readonly kind: "text" | "count" | "time"
}

/** The current state of one connected account, rendered for a person: level 1 of a provider, beside its named reads. */
export interface ProviderInfo {
    /** The connected account. */
    readonly connectionId: string
    /** `ok`: it works; `attention`: it needs the owner (not connected, or its last failure stands); `off`: disconnected. */
    readonly state: "ok" | "attention" | "off"
    /** At most six figures, in the order the provider wants them drawn. */
    readonly figures: ReadonlyArray<ProviderInfoFigure>
    /** As of when the figures hold, ISO 8601: the account's last event or sync; null or absent when the provider does not know. */
    readonly asOf?: string | null
}

/**
 * How fresh an answer of level 1 is. `live`: read from the outside system at the moment of the call; `synced`: read from what NIVO
 * stored the last time the provider's background work ran. Every answer the door hands a screen says which, with `asOf`.
 */
export type ReadFreshness = "live" | "synced"

/** The state of an account, or null when the workspace has no such account of the provider. */
export type OptionalProviderInfo = ProviderInfo | null

/*
 * The reads of the core providers are named by the SDK's `API` (`API.sepay.info`: an account's current state, payload `{ connectionId }`;
 * `API.zaloOa.config` / `.rights`: the registry reads every catalogued provider's account answers, the trigger switches and who decides on
 * each, and who holds what on the account) and served through `CORE_API_READS` (provider-reads.registry), total over `API`. What a
 * provider OFFERS at its three levels (the documentation tabs) is not read here: it is the provider-offer capability's read.
 */

/** The answer of a registry read as a JSON object, or null for a provider or an account the workspace does not have. */
export type OptionalRegistryAnswer = object | null

/** What answers the registry reads; each answers null for a provider or an account the workspace does not have. */
export interface ProviderRegistryReads {
    /** The configuration of one account beyond its connection: its trigger switches and deciders. */
    configOf(workspaceId: string, provider: string, connectionId: string): Promise<OptionalRegistryAnswer>
    /** The rights on one account: per agent, its tools and its part in each trigger. */
    rightsOf(workspaceId: string, provider: string, connectionId: string): Promise<OptionalRegistryAnswer>
}

/** A JSON Schema a read announces for its input or its output. */
export interface InterfaceReadSchema {
    /** One keyword of the schema. */
    readonly [keyword: string]: unknown
}

/** One read a provider offers a workspace's screens. */
export interface InterfaceProviderRead {
    /** The name of the read inside the provider (`crm.customer.find`, `transactions`). */
    readonly name: string
    /** `page`: rows with a cursor, for a list or a table; `record`: one record, for a detail. */
    readonly shape: "page" | "record"
    /** The schema of the input a screen sends. */
    readonly input: InterfaceReadSchema
    /** The schema of one row (`page`) or of the record (`record`); null when the provider cannot say. */
    readonly output: InterfaceReadSchema | null
}

/** Who reads: the proven member of the proven workspace. */
export interface InterfaceViewer {
    /** The workspace. */
    readonly workspaceId: string
    /** The seat of the person. */
    readonly memberId: string
}

/** What a provider read answers a screen. */
export type InterfaceProviderAnswer =
    | {
          readonly kind: "page"
          /** The rows, as generic list and table blocks take them. */
          readonly rows: ReadonlyArray<unknown>
          /** The cursor of the next page; null when there is none or rows were cut. */
          readonly cursor: string | null
          /** True when a text was cut or rows were dropped to fit. */
          readonly truncated: boolean
          /** How many rows were dropped. */
          readonly omitted: number
      }
    | { readonly kind: "record"; readonly record: unknown; readonly truncated: boolean }
    | { readonly kind: "refused"; readonly code: string; readonly message: string }

/** What a provider supplies for the workbench face. */
export interface InterfaceReadProvider {
    /** The provider key (`openapi`, `sepay`). */
    readonly provider: string
    /** How fresh its named reads are; absent means `live` (the read calls the outside system). An account's `info` is always `synced`. */
    readonly freshness?: ReadFreshness
    /** The reads the provider offers this workspace now: none for a workspace with no account of it. */
    readsOf(workspaceId: string): Promise<ReadonlyArray<InterfaceProviderRead>>
    /** The current state of one account of the workspace, for a person; absent when the provider offers no info. */
    infoOf?(workspaceId: string, connectionId: string): Promise<OptionalProviderInfo>
    /** Runs one read for a person; an unknown or unoffered read, and a failure of the provider, are thrown as its own errors. */
    read(viewer: InterfaceViewer, name: string, input: InterfaceReadSchema): Promise<InterfaceProviderAnswer>
}

/** A provider read named in a door call: the provider and the read inside it. */
export interface ProviderReadName {
    /** The provider key. */
    readonly provider: string
    /** The read inside the provider. */
    readonly read: string
}

/** A provider read name, or null when the call names a module read. */
export type OptionalProviderReadName = ProviderReadName | null

/**
 * The member of a named read's payload that asks for a live answer: `{ ..., "fresh": true }` skips the account's stored answer (the
 * refresh of a page). It is the door's own member: it is taken off before the input reaches the provider.
 */
export const PROVIDER_READ_FRESH = "fresh"

/** A named read's payload as the door splits it for the account's stored answers. */
export interface ProviderReadPayload {
    /** What the provider is handed: the payload without the door's `fresh` member. */
    readonly input: InterfaceReadSchema
    /** The account the read names (`connectionId` of the payload); null when it names none, so nothing is stored. */
    readonly connectionId: string | null
    /** True when the payload carries `fresh: true`: the provider is asked whatever the account stores. */
    readonly fresh: boolean
}

/** The door's answer of a named read from the account's stored answer, or null when the provider is asked. */
export type OptionalStoredDoorAnswer = DoorAnswer | null

/** A named read as its stored answer is keyed: the verb and the hash of its canonical arguments. */
export interface InterfaceCall {
    /** The read's door name (`<provider>:<read>`, whichever spelling the call used: an API verb resolves to the same). */
    readonly verb: string
    /** The sha256 of the canonical arguments. */
    readonly argsHash: string
}
