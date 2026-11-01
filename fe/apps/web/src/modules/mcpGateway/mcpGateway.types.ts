import type { useFormatter, useTranslations } from "next-intl"

/** The tones a gateway badge may take. */
export type McpTone = "success" | "warning" | "accent" | "neutral" | "danger"

/** One badge of a gateway row. */
export interface McpBadgeView {
    readonly label: string
    readonly tone: McpTone
}

/** The words of the gateway region (the `mcpGateway` catalog). */
export type McpTranslator = ReturnType<typeof useTranslations<"mcpGateway">>
/** The reader-locale formatter of dates and numbers. */
export type McpFormatter = ReturnType<typeof useFormatter>
