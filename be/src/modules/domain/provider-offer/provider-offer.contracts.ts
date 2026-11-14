/**
 * WHAT A PROVIDER OFFERS, as its page documents it: the three levels of the provider of one connected account, read from the
 * registries alone (the interface reads, the gateway's tool specs with the plugins' declarations and the pinned OpenAPI document, the
 * trigger catalogue). It holds no figure, list or live datum of the account: those are the workbench's. Words are the registry's own
 * (bilingual where it has them, null where it has none); nothing here is written for the page.
 */

/** Words in the owner's two languages, exactly as a registry declares them. */
export interface OfferWords {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** One member of a parameter list, a returned record or a trigger payload. */
export interface OfferedMember {
    /** Its name, as a caller sends it or a reader finds it. */
    readonly name: string
    /** Its JSON type as the schema declares it (`string`, `integer`, `string|null`, `array<object>`; `id`, `integer`, `choice` for a trigger), or null when the schema says none. */
    readonly type: string | null
    /** Its JSON format (`uuid`, `date-time`), or null. */
    readonly format: string | null
    /** True when the caller must send it (a trigger payload member is always present). */
    readonly required: boolean
    /** The closed values it takes, empty when it is not a closed choice. */
    readonly choices: ReadonlyArray<string>
    /** What it means in the owner's two languages, when the registry declares that (trigger payloads); else null. */
    readonly label: OfferWords | null
    /** What it means in the one language the schema declares it in, or null. */
    readonly description: string | null
    /** True when a workflow's trigger filter may compare it; false for every member that is no trigger payload member. */
    readonly filterable: boolean
}

/** How fresh an answer of level 1 is: read from the outside system at the call, or from what NIVO stored at its last sync. */
export type OfferFreshness = "live" | "synced"

/** One read of level 1 (the API for the interface). */
export interface OfferedRead {
    /**
     * The name a screen calls it by at the person-read door: its API verb (`nivo.api.sepay.info`, `nivo.api.crm.get.customers`), what
     * interfaces write as `API.*` or a generated `<KEY>_API`. The door also serves the old `<provider>:<read>` of stored bindings.
     */
    readonly name: string
    /** `read` today; level 1 has no write yet. */
    readonly kind: "read" | "write"
    /** `page`: rows with a cursor; `record`: one record; `info`: the current figures of the account. */
    readonly shape: "page" | "record" | "info"
    /** How fresh its answer is. */
    readonly freshness: OfferFreshness
    /** One line of what it answers, when the registry declares one; else null. */
    readonly summary: OfferWords | null
    /** The members of its input. */
    readonly parameters: ReadonlyArray<OfferedMember>
    /** The members of one row (`page`) or of the record; empty when the provider does not say. */
    readonly returns: ReadonlyArray<OfferedMember>
}

/** The effect a provider marks on a tool; null on the tool when it marks none. */
export type OfferedEffect = "money" | "irreversible" | "none"

/** How a Swagger tool stands against the account's pinned OpenAPI document. */
export interface OfferedOperation {
    /** The HTTP method of its operation, or null when the document has no such operation. */
    readonly method: string | null
    /** The path of its operation, or null when the document has no such operation. */
    readonly path: string | null
    /** `ready`: it can be called; `missing`, `unsupported`, `mode_mismatch`: why not. */
    readonly state: "ready" | "missing" | "unsupported" | "mode_mismatch"
    /** The unsupported features of its operation, by name. */
    readonly unsupported: ReadonlyArray<string>
}

/** One tool of level 2 (an agent calls it through the gateway). */
export interface OfferedTool {
    /** The full tool id (`nivo.tool.bank.transaction.list`, `nivo.api.crm.nivoweb.get.customers.code`). */
    readonly id: string
    /** Whether it only reads or also acts. */
    readonly kind: "read" | "write"
    /** The effect the provider marks on it, or null when none is declared (never inferred from words). */
    readonly effect: OfferedEffect | null
    /** Its name in the owner's two languages, when a plugin labels it; else null. */
    readonly title: OfferWords | null
    /** What it lets an agent do, one line, when a plugin labels it; else null. */
    readonly summary: OfferWords | null
    /** What it does in the one language its gateway spec is written in, or null when no spec is registered. */
    readonly description: string | null
    /** The members of its arguments. */
    readonly parameters: ReadonlyArray<OfferedMember>
    /** The members of its answer, when its definition declares a result schema; else empty. */
    readonly returns: ReadonlyArray<OfferedMember>
    /** How it stands against the pinned document, for a tool of the OpenAPI provider whose account pinned one; else null. */
    readonly operation: OfferedOperation | null
}

/** How the events of one emission are grouped into runs. */
export interface OfferedBatching {
    /** `each`: one run per event; `list`: one run per emission with the event ids. */
    readonly mode: "each" | "list"
    /** The most events one `list` run takes; null for `each`. */
    readonly maxEvents: number | null
}

/** One trigger of level 3 (the provider's background work emits it; a workflow may register on it). */
export interface OfferedTrigger {
    /** Its name inside the provider (`transaction.received`). */
    readonly name: string
    /** How the provider learns of it. */
    readonly kind: "webhook" | "poll"
    /** What it is, in the owner's two languages. */
    readonly summary: OfferWords
    /** The members of one event's payload. */
    readonly payload: ReadonlyArray<OfferedMember>
    /** How events are grouped into runs. */
    readonly batching: OfferedBatching
    /** How a missed event is recovered: the reader's cursor, the provider's reconcile pass, or nothing. */
    readonly recovery: "cursor" | "reconcile" | "none"
    /** True when one agent decides on its events and every other registered one is only told. */
    readonly decided: boolean
}

/** What the provider of one connected account offers at its three levels; a level the provider lacks is an empty list. */
export interface ProviderOffer {
    /** The connected account asked about. */
    readonly connectionId: string
    /** Its provider key. */
    readonly provider: string
    /** Level 1: the reads a screen may call. */
    readonly api: ReadonlyArray<OfferedRead>
    /** Level 2: the tools an agent may call. */
    readonly mcp: ReadonlyArray<OfferedTool>
    /** Level 3: the triggers its background work emits. */
    readonly triggers: ReadonlyArray<OfferedTrigger>
}

/** Who asks: a member of the workspace. */
export interface ProviderOfferActor {
    /** The signed-in person. */
    readonly principalId: string
    /** The workspace asked in. */
    readonly workspaceId: string
}
