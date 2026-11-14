import type { ModuleCapabilityRole } from "@nivo-lite/agent-sdk/module"
import type { ManifestAnswers, ToolJson } from "@modules/domain/tool-receipts"
import type { GrantMode } from "@modules/domain/tool-grants"
import type { ToolArgumentSchema } from "./tool-arguments.schema"

/** A provider operation's label (`money`, `irreversible`, `none`): DISPLAY information only; it never changes a mode (nivo-frame `rights`). */
export type ToolEffect = "money" | "irreversible" | "none"

/** What a tool does to the connected system. */
export type ToolScope = "read" | "write" | "restricted"

/** A JSON value accepted at the connector argument boundary. */
export type ToolArgument =
    | string
    | number
    | boolean
    | null
    | ReadonlyArray<ToolArgument>
    | {
          readonly [member: string]: ToolArgument
      }

/** One tool of a tool family, without the namespace. */
export interface ManifestTool {
    /** The family's own name for it, for example "credit.list". */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Read, write or restricted. */
    readonly scope: ToolScope
    /** Its JSON schema. */
    readonly inputSchema: ToolJson
    /** The owning tool's validator, used before any right is considered. */
    readonly argumentSchema: ToolArgumentSchema
    /** The mode a new grant starts at. */
    readonly defaultMode: GrantMode
    /** Members masked in the audit besides the standard secret names. */
    readonly secretFields?: ReadonlyArray<string>
    /**
     * The argument a side-effect tool takes its replay key in (for example `idempotencyKey`); the gateway fills it on every call that
     * names none, so a retry or a replayed approval of the same step never acts twice.
     */
    readonly idempotencyArg?: string | undefined
    /** The NIVO capability this tool plays, when it declares one (see `CapabilityRole`). */
    readonly role?: CapabilityRole
    /** The domain tool `<group>.<action>` (`nivo.tool.customer.message.send`) this tool plays for the door, when it plays one: the door resolves a domain tool to the first usable tool declaring it. */
    readonly domain?: string
    /**
     * True for a tool no customer conversation and no customer-facing agent may run: with a conversation or a customer audience on the caller it is hidden from search and describe,
     * and a call is refused `internal_only`, audited, before any adapter runs.
     */
    readonly internalOnly?: boolean
    /**
     * True for a tool whose answer carries text a stranger may have written (documents, messages): once it answered, a write of the
     * same turn needs a person's approval, however its grant reads, because the text may be trying to steer the agent.
     */
    readonly taints?: boolean
    /**
     * True for a tool whose adapter keeps its own once-per-key ledger (a NIVO effect tool: a success is kept under the step's key, a
     * refusal or a throw is not): the gateway's durable receipt is not used, so a refusal or a failure is really asked again.
     */
    readonly ledgered?: boolean
    /**
     * True for a tool a graph step may call on its declared allow-list alone (a NIVO effect tool): with no grant row of the owner, the
     * step's allow-list grants it; a grant row, when the owner set one, still decides (never, ask, limits).
     */
    readonly stepGranted?: boolean
    /** True for a write the taint rule never holds: its arguments are ids only and its hard guards live in its own executor. */
    readonly taintExempt?: boolean
    /**
     * True for a write that only FILES A REQUEST a person then decides on its own card (a change to a truth the founder applies or
     * rejects): it changes nothing by itself. Its grant is a default every agent holds (as the second brain's reads), inside a graph step
     * only for a step that declares it, and the taint rule never holds it: the person who decides the request IS the approval, so a
     * second approval in front of it would ask twice for the same thing. An owner's grant row on it still decides (never, ask).
     */
    readonly filesRequest?: boolean
    /**
     * True for a read of the truth graph whose answer names each truth it served as `{ id, v }` (under `facts`, `fact`, or `related[].fact`):
     * the audit line keeps that list (`fact_reads`) with the run of the call, so a run records which truth, at which version, its agent
     * read (concept.agent-knowledge: every decision records the knowledge it used).
     */
    readonly readsTruths?: boolean
    /**
     * What a call does that cannot be taken lightly (`money`, `irreversible`, `none`), stated by a hand-written tool; absent = not
     * stated (never inferred). NIVO's own tools state it in `CORE_TOOL_MARKS` by tool id.
     */
    readonly effect?: ToolEffect
    /**
     * The providers a tool answered per provider (`isProviderParted`: `nivo.tool.connection.status.get`) has a part for, as its adapter
     * registered them: the gateway judges each part as its own call on that provider and hands the adapter the parts it may answer.
     * Absent for every other tool.
     */
    readonly providerParts?: ReadonlyArray<string>
}

/**
 * The small vocabulary of capabilities a deterministic NIVO flow asks for, without naming any tool family. A tool declares its role
 * in its family's manifest, and `roleReadinessOf` reads whether the code plays it. Each role fixes a minimal argument and answer shape; anything
 * else a family answers stays opaque `ToolJson`:
 * - `identity.find` `{ channel, externalId }` -> `{ found: boolean, partyId?: string, name?: string }`
 * - `identity.upsert` `{ channel, externalId, name?, phone? }` -> `{ partyId: string }`
 * - `receivable.find` `{ reference }` (the raw payment memo; the connector parses its own format) ->
 *   `{ found: boolean, receivableId?: string, balanceVnd?: number }`
 * - `receivable.recordPayment` `{ receivableId, amountVnd, paymentRef }` -> `{ paymentId: string, duplicate?: boolean }`
 * - `payment.credits.list` `{ status?, since?, limit? }` -> `{ transactions: [{ id, amountVnd, reference, payer, status, occurredAt }] }`
 * - `payment.debits.list` (money out, for example supplier payments) takes and answers the same shapes as the credits
 * - `invoice.list` `{ since?: YYYY-MM-DD, limit? }` -> `{ invoices: [{ id, sellerTaxCode, sellerName, number, series, issuedOn,
 *   totalVnd, vatVnd, format }] }`
 */
export type CapabilityRole = ModuleCapabilityRole

/** The tool a workspace plays a role with. */
export interface RoleTool {
    /** The role. */
    readonly role: CapabilityRole
    /** The full name `<connector>.<tool>` to call. */
    readonly name: string
    /** The connector key. */
    readonly connector: string
    /** The connector's display name, for the source label of what the tool answered. */
    readonly connectorName: string
}

/** Whether a workspace can play some roles now, and which connectors could play each role of the vocabulary. */
export interface RoleReadiness {
    /** True when every asked role has a usable tool (no role asked is ready). */
    readonly ready: boolean
    /** The asked roles no usable tool plays. */
    readonly missing: ReadonlyArray<CapabilityRole>
    /**
     * For every role of the vocabulary, the display names of the workspace's connectors whose catalog declares it, installed or
     * installable, approved or not: the data of "connect one of these".
     */
    readonly providers: Readonly<Record<CapabilityRole, ReadonlyArray<string>>>
}

/** A full tool name `<connector>.<tool>`, or null when none plays what was asked. */
export type OptionalToolName = string | null

/** The tool of a role, or the typed answer that the workspace has none (no installed, approved tool declares it). */
export type RoleResolution =
    | { readonly ok: true; readonly tool: RoleTool }
    | { readonly ok: false; readonly code: "no_capability"; readonly role: CapabilityRole }

/** The manifest of a tool family: its namespace, contract and tools, registered in code. */
export interface ToolManifest {
    /** The family's key, for example "sepay": the prefix of its tools' full names unless `namespace` says another. */
    readonly key: string
    /**
     * The public prefix of its tools' full names when it is not the key (`nivo` for NIVO's own families, whose keys stay distinct:
     * `nivo-context`). A full name is resolved through the index of every family's full names, never by splitting at a dot, so two
     * families may share a prefix; two tools with one full name refuse the app's start.
     */
    readonly namespace?: string
    /** The display name. */
    readonly name: string
    /** The contract version, for example "sepay-native@1". */
    readonly contractVersion: string
    /** The tools; every one has a bounded schema. */
    readonly tools: ReadonlyArray<ManifestTool>
    /**
     * The shape of every answer of the family, when it is a known envelope: `envelope` for the OpenAPI family (its manifest, in code,
     * says so). Absent: the answers are the tools' own values.
     */
    readonly answers?: ManifestAnswers
    /**
     * The per-call limit the family's own code declares, milliseconds, up to the engine's ceiling (`NATIVE_TIMEOUT_CEILING_MS`, 10 min);
     * absent = the registry's default.
     */
    readonly timeoutMs?: number
}
