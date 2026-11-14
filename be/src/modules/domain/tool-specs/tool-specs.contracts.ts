import type { TOOL, ToolNames } from "@nivo-lite/agent-sdk/names"

/** The id of one CORE tool: a value of `TOOL` (a source's generated ids get their spec from the pinned document, `sourceToolSpecOf`). */
export type CoreToolId = (typeof TOOL)[keyof typeof TOOL]

/**
 * How a call of the tool finds its account:
 * - `none`: it acts on no connected account (NIVO's own records, the team chat, the brain);
 * - `owner`: the account its DATA names (the conversation's own connection of a customer send): the executor reads it;
 * - `any`: ONE account of the node's bound list, in its order, falling back by the class (C4.3, C4.6);
 * - `each`: a read that covers every held account at once (its adapter merges them).
 */
export type ToolAccountMode = "none" | "owner" | "any" | "each"

/** The kind of data a tool's call reaches, as a governed agent's data rights name it (the store's kinds). */
export type ToolDataKind =
    | "brain"
    | "customers"
    | "documents"
    | "payments"
    | "channels"
    | "invoices"
    | "mail"
    | "domains"
    | "media"

/**
 * The business refusals a tool answers a node (`{ ok: false, refusal }`). `closed`: the codes are every code it can answer (its
 * executor's literals, the typed unions it hands on, the engine's refusals of its road), so `ToolNames[id]["refusals"]` is their union;
 * else the codes are the ones known by reading and the SDK keeps `refusal: string`.
 */
export interface ToolRefusals {
    /** True when the codes are all the codes the tool can answer. */
    readonly closed: boolean
    /** The codes. */
    readonly codes: ReadonlyArray<string>
}

/** A refusal set as the registry must state it for a tool the SDK types `R`: closed exactly when the SDK holds a union. */
export interface TypedRefusals<R extends string> extends ToolRefusals {
    /** Closed exactly when the SDK types the refusals as a union of codes. */
    readonly closed: string extends R ? false : true
    /** The codes, typed as the SDK's union. */
    readonly codes: ReadonlyArray<R>
}

/**
 * What the engine knows of one tool: generic facts only (nivo-frame `engineNoBusiness`): whether it writes, who serves its purpose, how
 * its account is found, its data kind, its refusals and whether it may be sent again on an unknown outcome. No class, no money mark, no
 * default mode: the node's declared mode is the only mode. A platform purpose is served by its PROVIDERS (its owners), never by a CRM's
 * document marking it (owner ruling R57: a CRM serves its own generated operations only).
 */
export interface ToolSpec {
    /** False for a read (only looks: it never asks, and on any failure it may go on to the next account); true for a write. */
    readonly mutates: boolean
    /** The providers that own the purpose (adapters, in no particular order: the order is the node's); `nivo` for an engine-owned tool. */
    readonly owners: ReadonlyArray<string>
    /** How its account is found. */
    readonly account: ToolAccountMode
    /** The kind of data it reaches for a governed agent, or null when it reaches none the store holds (refused `no_kind`). */
    readonly dataKind: ToolDataKind | null
    /**
     * The members of the arguments that make the call once per business key across runs (C4.2), as its executor already enforces it;
     * empty when only the call key holds it. Read by nothing yet: the ledger keys by the call.
     */
    readonly onceBy: ReadonlyArray<string>
    /** Its business refusals. */
    readonly refusals: ToolRefusals
    /**
     * Whether the engine may make the SAME call again (same call key) when its outcome is UNKNOWN (a timeout or a broken answer after the
     * request left), under its bounded retry (rulings R73, R74). DECLARED by the tool, never guessed by the engine: true for a read and for a
     * write whose worst case of a second effect is acceptable (the customer send: at most a duplicate line); false for a write that moves
     * money or writes at a provider (a renewal, an invoice, an order at a third party): on an unknown outcome such a call stops for a person
     * at once and is never sent again by itself.
     */
    readonly repeatable: boolean
    /**
     * The members of the arguments that are the CONTENT a person approves (the customer send: its `text` and its `images`): the approval
     * card carries them in full, read by shape (a string is words, a list of `{ url }` is addresses), beyond the short facts. Absent or
     * empty: the card shows the call's facts only.
     */
    readonly approvalContent?: ReadonlyArray<string> | undefined
}

/** A spec whose refusals the SDK types `R`. */
export interface TypedToolSpec<R extends string> extends ToolSpec {
    /** The refusals, typed as the SDK states them. */
    readonly refusals: TypedRefusals<R>
}

/** The refusal codes the SDK types for a core tool: a union for a closed set, `string` otherwise. */
export type RefusalsOf<K extends CoreToolId> = ToolNames[K] extends { readonly refusals: infer R extends string } ? R : string

/** The registry: one spec per core tool, its refusals typed by the SDK's signature. */
export type ToolSpecRegistry = { readonly [K in CoreToolId]: TypedToolSpec<RefusalsOf<K>> }

/** A tool's spec, or null for an id that is no core tool. */
export type OptionalToolSpec = ToolSpec | null
