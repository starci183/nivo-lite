import type { PinnedToolAudience, PinnedToolState, UndeclaredOperation } from "./openapi-pin.policy"

/** What a pin report is written from: the pin as its owner reads it, and how the document opens each tool to customers. */
export interface PinReportFacts {
    /** The source key the account serves (the pinned document's own). */
    readonly connector: string
    /** The header its workspace id goes in. */
    readonly workspaceHeader: string
    /** Whether writes act for real. */
    readonly live: boolean
    /** The sha256 of the canonical document. */
    readonly documentSha256: string
    /** How each declared tool of the source stands against the document. */
    readonly tools: ReadonlyArray<PinnedToolState>
    /** How the document opens each declared tool to a run that serves a customer. */
    readonly audiences: ReadonlyArray<PinnedToolAudience>
    /** The operations of the document no installed plugin declares a tool for, by the tool id each would be served under. */
    readonly undeclared: ReadonlyArray<UndeclaredOperation>
}

/** The counts of a pin by the state of its tools, and how many the document opens to customers. */
export interface PinCounts {
    /** Tools that can be called. */
    readonly ready: number
    /** Tools whose operation the document lacks. */
    readonly missing: number
    /** Tools whose operation uses a feature the provider does not support. */
    readonly unsupported: number
    /** Tools declared a read on an operation that is no GET. */
    readonly modeMismatch: number
    /** Tools the document opens to a run that serves a customer. */
    readonly customerAudience: number
}

/** The part of the report facts the counts of a pin are taken from. */
export type PinCountsFacts = Pick<PinReportFacts, "audiences" | "tools">

/** The counts of a pin. */
export const pinCountsOf = (facts: PinCountsFacts): PinCounts => {
    const inState = (state: PinnedToolState["state"]): number =>
        facts.tools.filter((tool) => tool.state === state).length
    return {
        ready: inState("ready"),
        missing: inState("missing"),
        unsupported: inState("unsupported"),
        modeMismatch: inState("mode_mismatch"),
        customerAudience: facts.audiences.filter((audience) => audience.customerAudience).length,
    }
}

/** How the document opens one tool to customers, as the report says it. */
const audienceOf = (audience: PinnedToolAudience | undefined): string => {
    if (audience?.customerAudience !== true) return "internal"
    return audience.customerParameter === null ? "customer" : `customer(${audience.customerParameter})`
}

/** One line of the report for one tool: its state, where the document serves it, its effect mark and who may call it. */
const toolLineOf = (tool: PinnedToolState, audience: PinnedToolAudience | undefined): string => {
    const place = tool.method === null || tool.path === null ? "-" : `${tool.method} ${tool.path}`
    const why = tool.unsupported.length === 0 ? "" : ` [${tool.unsupported.join("; ")}]`
    return `  ${tool.state} ${tool.tool} ${place} effect=${tool.effect ?? "unmarked"} audience=${audienceOf(audience)}${why}`
}

/** One line of the report for an operation no plugin declares: its tool id and where the document serves it. */
const undeclaredLineOf = (operation: UndeclaredOperation): string =>
    `  undeclared ${operation.toolId} ${operation.method} ${operation.path}`

/**
 * The report of a pin as lines of plain text: the source key, the header, whether writes act for real, the sha256 of the canonical
 * document, the counts, then one line per declared tool in the order the plugin declares them, then one line per operation no plugin declares (by the tool
 * id it would be served under). It holds no key, no base URL and
 * nothing of the document but the method and the path of the declared operations.
 */
export const pinReportOf = (facts: PinReportFacts): ReadonlyArray<string> => {
    const counts = pinCountsOf(facts)
    const audiences = new Map(facts.audiences.map((audience) => [audience.tool, audience]))
    return [
        `connector ${facts.connector}, workspace header ${facts.workspaceHeader}, live ${String(facts.live)}`,
        `document sha256 ${facts.documentSha256}`,
        `tools ${String(facts.tools.length)}: ready ${String(counts.ready)}, missing ${String(counts.missing)}, unsupported ${String(counts.unsupported)}, mode_mismatch ${String(counts.modeMismatch)}; customer audience ${String(counts.customerAudience)}`,
        ...facts.tools.map((tool) => toolLineOf(tool, audiences.get(tool.tool))),
        ...facts.undeclared.map((operation) => undeclaredLineOf(operation)),
    ]
}
