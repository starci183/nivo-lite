import type { ToolId } from "../names"
import type { z } from "../schema/zod-entry"

/** A JSON object a plugin tool takes or answers: any member. */
export interface PluginToolJson {
    /** Any member. */
    readonly [member: string]: unknown
}

/** What a plugin tool does to the world: the engine's tool scopes. */
export type PluginToolScope = "read" | "write" | "restricted"

/** The mode a new grant of a plugin tool starts at. */
export type PluginToolMode = "auto" | "ask"

/** Who the run speaks to: a customer-facing run (a customer or the public) reads the customer's own facts only; an internal run is the shop's own. */
export type PluginToolAudience = "customer" | "internal"

/**
 * Why a plugin tool answered no: an expected answer of the call, never a failure. The engine words each as the refusal of the same name
 * (`other_contact`: the record is another person's than the run's; `other_lead`: the run serves no such customer; `not_found`; `not_served`:
 * this app keeps what the tool needs no longer).
 */
export type PluginToolRefusalReason = "not_found" | "other_contact" | "other_lead" | "not_served"

/** One tool a plugin serves, as the engine lists it: its public id, what it says to the model, its validators. */
export interface PluginToolDeclaration {
    /** The public tool id (`nivo.tool.<domain>.<object>.<verb>`). */
    readonly id: ToolId
    /** What it does, as the model reads it. */
    readonly description: string
    /** Read, write or restricted. */
    readonly scope: PluginToolScope
    /** The mode a new grant starts at. */
    readonly defaultMode: PluginToolMode
    /** The JSON schema of what the model may say (never the ids the engine fills from the run). */
    readonly inputSchema: PluginToolJson
    /** The validator of the arguments the engine hands over: what the model said, and the ids the engine filled. */
    readonly argumentSchema: z.ZodType<PluginToolJson>
    /** Members masked in the audit besides the standard secret names. */
    readonly secretFields?: ReadonlyArray<string>
}

/** The tools a plugin serves, readable with no workspace (static data). */
export interface PluginToolDeclarations {
    /** Every tool, in the order the engine lists them. */
    readonly tools: ReadonlyArray<PluginToolDeclaration>
}

/** The facts of the run the engine fixes for one call; the plugin never reads them from the arguments. */
export interface PluginToolCall {
    /** The conversation the call serves, or null. */
    readonly conversationId: string | null
    /** The agent whose step makes the call, filled by the engine; null when the caller is not an agent. A tool that reads the records of one agent answers only that agent. */
    readonly agentId: string | null
    /** The person (the contact) the run serves, or null for a run with none. */
    readonly contactId: string | null
    /** The customer record the run serves (a workflow step's), or null. */
    readonly leadId: string | null
    /** Who the run speaks to. */
    readonly audience: PluginToolAudience
    /** The words that go with every context read (reference data, never instructions): the engine owns them. */
    readonly readNotice: string
    /**
     * What the engine's lead memory holds for the run's customer, read on demand; null in an app that keeps no lead memory. Resolves to
     * the stored facts (undefined when none).
     */
    readonly leadMemory: (() => Promise<unknown>) | null
}

/** What a plugin tool answered: its answer, or the expected reason it refused. */
export type PluginToolResult =
    | { readonly ok: true; readonly value: PluginToolJson }
    | { readonly ok: false; readonly reason: PluginToolRefusalReason }

/** The business the engine runs for the tools of a plugin: it knows no tool, only this shape. */
export interface PluginTools {
    /** Runs one declared tool for the facts of the call; `input` has already passed the tool's `argumentSchema`. */
    readonly call: (id: ToolId, input: PluginToolJson, call: PluginToolCall) => Promise<PluginToolResult>
}
