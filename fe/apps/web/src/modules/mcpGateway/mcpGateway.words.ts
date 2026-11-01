import type { McpBadgeView, McpTranslator } from "./mcpGateway.types"

/** The catalog text of a native tool (`sepay.transactions.list` reads `tool_sepay-transactions-list`; its plain name `toolName_...`), else what its server sent. */
export const toolTextOf = (t: McpTranslator, kind: "tool" | "toolName", id: string, fallback: string): string => {
    const key = `${kind}_${id.replaceAll(".", "-")}`
    return t.has(key) ? t(key) : fallback
}

/** Parsed JSON text, or undefined when it is not JSON. */
const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

/** The constraint badge of a grant: how many argument constraints it holds, nothing when none. */
export const constraintBadgesOf = (t: McpTranslator, constraintsJson: string): ReadonlyArray<McpBadgeView> => {
    const parsed: unknown = parseJson(constraintsJson)
    return Array.isArray(parsed) && parsed.length > 0
        ? [{ label: t("constraintsCount", { count: parsed.length }), tone: "neutral" }]
        : []
}

/** The first words of the ids of the tools an agent has beside the connectors (`knowledge.search`, `booking.request`). */
const AGENT_TOOL_HEADS: ReadonlySet<string> = new Set([
    "knowledge",
    "memory",
    "lead",
    "approval",
    "handoff",
    "conversation",
    "tool",
    "booking",
])

/**
 * The plain name of a tool the screen shows. A tool of the platform (an agent tool, or a tool of a native connector in
 * `nativeKeys`) that the catalog has no name for says a general phrase, never its id; only a tool of a remote server says the name
 * its server gave, as that is the name its owner registered.
 */
export const toolNameOf = (t: McpTranslator, id: string, nativeKeys: ReadonlySet<string>): string => {
    const named = toolTextOf(t, "toolName", id, "")
    if (named !== "") return named
    const head = id.split(".")[0] ?? id
    return nativeKeys.has(head) || AGENT_TOOL_HEADS.has(head) ? t("toolUnnamed") : id
}

/** The words of an agent's mode for a tool; a mode outside the table says nothing raw. */
export const modeWordOf = (t: McpTranslator, mode: string): string =>
    t.has(`mode_${mode}`) ? t(`mode_${mode}`) : t("mode_never")

/** The words of a call's outcome: done, waiting for approval, else failed (the failure code stays in the log, not on the screen). */
export const outcomeWordOf = (t: McpTranslator, outcome: string): string =>
    t.has(`outcome_${outcome}`) ? t(`outcome_${outcome}`) : t("outcome_failed")

/** What an audited call was asked with, in words: the arguments the table knows, else how many there were (a masked value is never printed). */
export const argsWordsOf = (t: McpTranslator, argsMaskedJson: string): string => {
    const parsed: unknown = parseJson(argsMaskedJson)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return ""
    const names = Object.keys(parsed)
    if (names.length === 0) return ""
    const queryChars: unknown = Reflect.get(parsed, "query_chars")
    if (names.length === 1 && typeof queryChars === "number") return t("argQueryChars", { count: queryChars })
    return t("argsCount", { count: names.length })
}
