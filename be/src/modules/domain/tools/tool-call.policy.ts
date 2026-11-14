import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type {
    CapabilityRole,
    ToolCaller,
    ToolJson,
    ManifestTool,
    OptionalToolName,
    RoleResolution,
    WorkspaceToolFamily,
} from "./tools.contracts"
import { toolNameOf } from "./tool-name.policy"

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

/**
 * True when the caller may see the tool: a tool for internal use is hidden from a customer-facing agent always, and from a customer
 * conversation unless the call is a workflow step (`graphStep`), whose conversation is only the one its run carries: the step of an
 * internal agent (the accounting step that writes the books) keeps its internal tools whoever started the run.
 */
export const toolVisibleTo = (caller: ToolCaller, spec: ManifestTool): boolean =>
    spec.internalOnly !== true ||
    (caller.audience !== "customer" && (caller.conversationId === null || caller.graphStep === true))

/** The tool of a role among the tool families: the first tool declaring it; none is `no_capability`. */
export const roleIn = (connectors: ReadonlyArray<WorkspaceToolFamily>, role: CapabilityRole): RoleResolution => {
    const [tool] = connectors
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.role === role)
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
 * The full tool name (its family's public prefix and its own name) that plays a domain tool among the tool families
 * (`nivo.tool.customer.message.send`): the first tool declaring the domain; null when none does.
 */
export const domainNameIn = (connectors: ReadonlyArray<WorkspaceToolFamily>, domain: string): OptionalToolName => {
    const [name] = connectors
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.domain === domain)
                .map((spec) => toolNameOf(connector.manifest, spec.name)),
        )
    return name ?? null
}

/** True for the registry's own time-limit error. */
export const isTimeout = (cause: unknown): boolean =>
    cause instanceof ToolsError && cause.code === ToolsErrorCode.Timeout

/** The answer of a native adapter that refused an expected case (its reason), or null for any other failure. */
export const refusalOf = (cause: unknown): ToolJson | null =>
    cause instanceof ToolsError && cause.code === ToolsErrorCode.NativeRefused
        ? { error: String(cause.params["reason"] ?? "refused") }
        : null

/** The param a native refusal carries its class in (`native-tools`' `nativeRefusalParamsOf`); a refusal thrown without it is infrastructure. */
const REFUSAL_CLASS_PARAM = "refusalClass"

/**
 * The reason of a native adapter's refusal that its SOURCE classed `business` (the typed class it was thrown with, never its words), or
 * null for a refusal of no class or of class `infrastructure`, and for any other failure.
 */
export const businessRefusalOf = (cause: unknown): string | null => {
    if (!(cause instanceof ToolsError) || cause.code !== ToolsErrorCode.NativeRefused) return null
    const reason = cause.params["reason"]
    return cause.params[REFUSAL_CLASS_PARAM] === "business" && typeof reason === "string" ? reason : null
}

/**
 * The typed reason of a native adapter's refusal, whatever its class (the `reason` param it was thrown with, never its words), or null
 * for a refusal thrown without a text reason and for any other failure.
 */
export const nativeRefusalReasonOf = (cause: unknown): string | null => {
    if (!(cause instanceof ToolsError) || cause.code !== ToolsErrorCode.NativeRefused) return null
    const reason = cause.params["reason"]
    return typeof reason === "string" && reason !== "" ? reason : null
}

/** The code a failed run is audited with. */
export const failureCodeOf = (cause: unknown): string =>
    cause instanceof ToolsError ? cause.code : "internal"
