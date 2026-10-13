import type { TemplateDef } from "@/lib/automation-shared"
import type { OverviewRows } from "./automations.rows"

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether the answer of `automations_data` has the shape the screen reads. */
export const isOverviewRows = (value: unknown): value is OverviewRows =>
    isRecord(value) &&
    Array.isArray(value.installations) &&
    Array.isArray(value.pipelines) &&
    Array.isArray(value.runs) &&
    Array.isArray(value.knowledge) &&
    Array.isArray(value.connections) &&
    Array.isArray(value.rules) &&
    typeof value.due_invoices === "number" &&
    typeof value.chat_agents === "number" &&
    typeof value.contracts === "number" &&
    typeof value.shipped_orders === "number"

/** Whether a stored definition has the fields a card reads. */
export const isTemplateDef = (value: unknown): value is TemplateDef =>
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.executor === "string" &&
    typeof value.pack === "string" &&
    isRecord(value.name) &&
    isRecord(value.description) &&
    isRecord(value.trigger) &&
    isRecord(value.requires) &&
    isRecord(value.authority) &&
    isRecord(value.defaults) &&
    Array.isArray(value.settings) &&
    Array.isArray(value.variables) &&
    Array.isArray(value.guardrails)
