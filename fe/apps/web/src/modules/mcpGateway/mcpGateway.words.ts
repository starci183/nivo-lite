import type { useTranslations } from "next-intl"

/** The words of the gateway region (the `mcpGateway` catalog). */
export type McpTranslator = ReturnType<typeof useTranslations<"mcpGateway">>

/** The catalog text of a native tool (`sepay.transactions.list` reads `tool_sepay-transactions-list`; its plain name `toolName_...`), else what its server sent. */
export const toolTextOf = (t: McpTranslator, kind: "tool" | "toolName", id: string, fallback: string): string => {
    const key = `${kind}_${id.replaceAll(".", "-")}`
    return t.has(key) ? t(key) : fallback
}

/** The plain name of a tool an agent used: the catalog's, else the words of its server, never the tool id. */
export const toolNameOf = (t: McpTranslator, id: string, described: string): string =>
    toolTextOf(t, "toolName", id, described === "" ? t("toolOther") : described)

/** The words of a grant's mode: on its own, ask first, or off; a mode this app does not know reads as off. */
export const modeWordOf = (t: McpTranslator, mode: string): string => {
    if (mode === "auto") return t("mode_auto")
    return mode === "ask" ? t("mode_ask") : t("mode_never")
}

/** The words of what became of a call; an outcome this app does not know reads as refused. */
export const outcomeWordOf = (t: McpTranslator, outcome: string): string => {
    if (outcome === "ok") return t("outcome_ok")
    return outcome === "approval" ? t("outcome_approval") : t("outcome_refused")
}
