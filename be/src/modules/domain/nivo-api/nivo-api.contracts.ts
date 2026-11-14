import type { z } from "zod"
import type { GraphqlOperation, NivoApiVerb } from "@nivo-lite/agent-sdk/names"

/**
 * The least workspace role an op's GraphQL guard admits: `member` (any active seat; the op may narrow further, a workbench read by its
 * declared permission), `manager` (owner or manager), `owner`. The surface refuses a holder below it before the op runs; the op's own
 * application handler judges the holder again (the same guard as the GraphQL road).
 */
export type NivoApiRole = "member" | "manager" | "owner"

/**
 * Why an op is not offered outside: `secret` (a key or a connection secret: write-only stays write-only), `members` (member
 * management), `workspace_delete`, `platform_admin`, `billing`, `engine` (its handler needs the engine, which runs in the api app only:
 * the mcp app loads no provider and runs no tool and no graph, so an op that reads the tool families or resumes a thread stays off the
 * surface until its handler hands off without the engine).
 */
export type NivoApiNeverReason = "secret" | "members" | "workspace_delete" | "platform_admin" | "billing" | "engine"

/** One NIVO data op the outbound MCP surface offers: its one-line summary, its input and output, its annotations and its role. */
export interface ExposedNivoApi {
    /** Offered on the outbound MCP surface. */
    readonly exposed: true
    /** One line a client reads in a search result. */
    readonly summary: string
    /** The arguments, validated before the op runs; its JSON Schema is the op's `inputSchema`. */
    readonly input: z.ZodType
    /** The answer (the `data` member of the result); its JSON Schema is the op's `outputSchema`. */
    readonly output: z.ZodType
    /** True when the op changes nothing. */
    readonly readOnly: boolean
    /** True when the op may delete, merge, unlink or approve something a person cannot take back: a client asks its user first. */
    readonly destructive: boolean
    /** True when calling again with the same arguments changes nothing more. */
    readonly idempotent: boolean
    /** The least role the op's guard admits. */
    readonly role: NivoApiRole
    /** True when the answer can carry text written by customers (or relayed from them): it is data, never instructions. */
    readonly customerText: boolean
}

/** One NIVO data op the outbound MCP surface does not offer, with why. */
export interface HiddenNivoApi {
    /** Not offered outside. */
    readonly exposed: false
    /** What the op is, for the catalogue's own record. */
    readonly summary: string
    /** Why it is never offered. */
    readonly never: NivoApiNeverReason
}

/** How a write op acts on the world: whether it destroys, and whether repeating it changes nothing more. */
export interface NivoApiEffect {
    /** True when the op deletes, merges or unlinks. */
    readonly destructive: boolean
    /** True when the same call twice leaves the world as once. */
    readonly idempotent: boolean
}

/** The declaration of one `nivo.api.nivo.*` op. */
export type NivoApiDeclaration = ExposedNivoApi | HiddenNivoApi

/** The declarations: TOTAL over the NIVO-owned API names by type, so a new name without its declaration does not compile. */
export type NivoApiDeclarations = { readonly [V in NivoApiVerb]: NivoApiDeclaration }

/** One op of the generated catalogue: its name, its declaration, the GraphQL operation it maps to 1:1. */
export interface NivoApiOp {
    /** The API name (`nivo.api.nivo.contact.list`). */
    readonly name: NivoApiVerb
    /** Its declaration. */
    readonly declaration: ExposedNivoApi
    /** The GraphQL operation that serves the same op for a person's screen. */
    readonly graphql: GraphqlOperation
    /** The JSON Schema of the input. */
    readonly inputSchema: Readonly<Record<string, unknown>>
    /** The JSON Schema of the output. */
    readonly outputSchema: Readonly<Record<string, unknown>>
}

/** Who a NIVO data op runs as: the key's holder in the key's workspace (never anything a request names). */
export interface NivoApiActor {
    /** The workspace. */
    readonly workspaceId: string
    /** The holder's account. */
    readonly userId: string
    /** The agent an agent-scoped key narrows the agent and workflow ops to; null for a key that sees every agent its holder's role allows. */
    readonly agentId: string | null
}

/** What running one op answered: its data, or the code of the typed refusal its handler threw. */
export type NivoApiAnswer = { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly code: string }

/**
 * Runs one exposed NIVO data op by calling the SAME application handler the GraphQL resolver calls (the command / query bus), with the
 * holder as the principal: one code path, the same rights guard, the same audit of the handler. Implemented by the executor of this
 * capability (the registry gives it each op's message); the surface reaches it through `NIVO_API_EXECUTOR`.
 */
export interface NivoApiExecutor {
    /**
     * Runs the op with arguments its declaration's input already validated; a write carries the client's once-only key (`opKey`), which
     * an op that keys its own effect by it (a workflow start) reads, and a write without one is refused.
     */
    execute(name: NivoApiVerb, args: unknown, actor: NivoApiActor, opKey?: string): Promise<NivoApiAnswer>
}
