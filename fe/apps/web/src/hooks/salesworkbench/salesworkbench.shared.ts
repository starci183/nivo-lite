import { SALES_TABS } from "@/hooks/sales"

/** The Sales desk's tabs when a customer conversation is open: the six panels plus the conversation itself. */
export const SALES_INBOX_TABS: readonly [
    "attention",
    "pipeline",
    "decisions",
    "handoff",
    "contracts",
    "activity",
    "conversation",
] = [...SALES_TABS, "conversation"] as const

/** One area of the Sales desk, named by its tab id. */
export type SalesArea = (typeof SALES_INBOX_TABS)[number]

/** The optional conversation and explanation remain actual product drawings, not data-status shapes. */
export const salesShapeOf = (tab: SalesArea, isOverview: boolean): SalesArea | "explanation" =>
    isOverview ? tab : "explanation"
