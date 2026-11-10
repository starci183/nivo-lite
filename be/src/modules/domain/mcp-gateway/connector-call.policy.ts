import { McpError, McpErrorCode } from "@modules/integrations/mcp"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type {
    CapabilityRole,
    GatewayCaller,
    GatewayJson,
    GatewayToolSpec,
    OptionalToolName,
    RoleResolution,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import type { AbilityVerdict } from "./provider-abilities.policy"
import { toolNameOf } from "./tool-name.policy"

/** What the tick of one ability on one connected account decides about a call: not allowed, run by itself, or ask a person first. */
export type AbilityDecision = "off" | "auto" | "ask"

/** The decision of a call, or null when the tool is no provider right. */
export type OptionalAbilityDecision = AbilityDecision | null

/** The verdict of the abilities on a call, or null when the tool is no provider right. */
export type OptionalAbilityVerdict = AbilityVerdict | null

/**
 * The decision of an ability verdict as the owner ticked it: a refusal (not attached, not ticked, no default account) is `off`, a call
 * that runs by itself is `auto`, a call that waits for a person is `ask`. Null when the tool is no provider right (its tool grant decides).
 */
export const abilityDecisionOf = (verdict: OptionalAbilityVerdict): OptionalAbilityDecision => {
    if (verdict === null) return null
    if (verdict.kind === "refuse") return "off"
    return verdict.kind === "approval" ? "ask" : "auto"
}

/** One argument of a call as a person reads it on a permission request. */
export interface CallWord {
    /** The argument's name. */
    readonly name: string
    /** Its value in plain text. */
    readonly value: string
}

/** The most arguments a permission request lists. */
export const CALL_WORDS_MAX = 12

/** The longest name of an argument on a permission request. */
const WORD_NAME_MAX = 100

/** The longest value of an argument on a permission request. */
const WORD_VALUE_MAX = 300

/** The mark of a value cut to fit. */
const ELLIPSIS = "…"

/** A text cut to its bound, marked when cut. */
const boundedText = (text: string, max: number): string =>
    text.length <= max ? text : `${text.slice(0, max - 1)}${ELLIPSIS}`

/** A value in plain text: a text as it is, a number or a yes/no as written, nothing as a dash, anything else as compact JSON. */
const plainOf = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (typeof value === "bigint") return value.toString()
    if (value === null || value === undefined) return "-"
    // Arguments arrive as parsed JSON (no cycle); a function or a symbol has no JSON and shows as nothing.
    return JSON.stringify(value) ?? "-"
}

/**
 * The arguments of one call in plain words, in the order the call gave them, at most `max` of them, each name and value bounded: what
 * a person approves on a permission request. A call whose arguments are no object has none to show.
 */
export const callWordsOf = (args: unknown, max: number = CALL_WORDS_MAX): ReadonlyArray<CallWord> => {
    if (typeof args !== "object" || args === null || Array.isArray(args)) return []
    return Object.entries(args)
        .filter(([, value]) => value !== undefined)
        .slice(0, Math.max(0, max))
        .map(([name, value]) => ({
            name: boundedText(name, WORD_NAME_MAX),
            value: boundedText(plainOf(value), WORD_VALUE_MAX),
        }))
}

/** True when the connector may run the tool: a native tool, or a remote tool whose live schema is the approved one. */
export const usable = (connector: WorkspaceConnector, tool: string): boolean =>
    connector.approvedTools === null || connector.approvedTools.has(tool)

/**
 * True when the caller may see the tool: a tool for internal use is hidden from a customer-facing agent always, and from a customer
 * conversation unless the call is a workflow step (`graphStep`), whose conversation is only the one its run carries: the step of an
 * internal agent (the accounting step that writes the books) keeps its internal tools whoever started the run.
 */
export const toolVisibleTo = (caller: GatewayCaller, spec: GatewayToolSpec): boolean =>
    spec.internalOnly !== true ||
    (caller.audience !== "customer" && (caller.conversationId === null || caller.graphStep === true))

/**
 * The tool of a role among connectors: the first tool declaring it among those not disabled (natives first, then remotes by
 * key) that may run; none is `no_capability`.
 */
export const roleIn = (connectors: ReadonlyArray<WorkspaceConnector>, role: CapabilityRole): RoleResolution => {
    const [tool] = connectors
        .filter((connector) => connector.status !== "disabled")
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.role === role && usable(connector, spec.name))
                .map((spec) => ({
                    role,
                    name: toolNameOf(connector.manifest, spec.name),
                    connector: connector.manifest.key,
                    connectorName: connector.manifest.name,
                })),
        )
    return tool === undefined ? { ok: false, code: "no_capability", role } : { ok: true, tool }
}

/**
 * The full tool name (its connector's public prefix and its own name) that plays a domain tool among connectors, `nivo.chat.send` or a
 * renamed `nivo.chat.send` alike: the first tool declaring the domain among those not disabled
 * (natives first, then remotes by key) that may run; null when the workspace has none.
 */
export const domainNameIn = (connectors: ReadonlyArray<WorkspaceConnector>, domain: string): OptionalToolName => {
    const [name] = connectors
        .filter((connector) => connector.status !== "disabled")
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.domain === domain && usable(connector, spec.name))
                .map((spec) => toolNameOf(connector.manifest, spec.name)),
        )
    return name ?? null
}

/** True for the gateway's own time-limit errors and the remote client's. */
export const isTimeout = (cause: unknown): boolean =>
    (cause instanceof McpError && cause.code === McpErrorCode.Timeout) ||
    (cause instanceof McpGatewayError && cause.code === McpGatewayErrorCode.Timeout)

/** The answer of a native adapter that refused an expected case (its reason), or null for any other failure. */
export const refusalOf = (cause: unknown): GatewayJson | null =>
    cause instanceof McpGatewayError && cause.code === McpGatewayErrorCode.NativeRefused
        ? { error: String(cause.params["reason"] ?? "refused") }
        : null

/** The code a failed run is audited with. */
export const failureCodeOf = (cause: unknown): string =>
    cause instanceof McpError || cause instanceof McpGatewayError ? cause.code : "internal"
