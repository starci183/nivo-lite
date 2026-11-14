import { crmNamesTextOf, crmOpsOf, type CrmOpsReading } from "@nivo-lite/agent-sdk/names"
import { parseJsonText } from "@modules/platform/primitives"
import { DOCUMENT_MAX_CHARS } from "./openapi-document.policy"

/** The operations a CRM's document gives, or why it gives none (`too_large`, `not_json` beside the SDK's own problems). */
export type ToolNamesReading = CrmOpsReading | { readonly ok: false; readonly problem: "too_large" | "not_json"; readonly at: null }

/**
 * The names a CRM's document gives (`cli openapi names --crm <id>`): the SDK's ONE derivation (`crmOpsOf`), so the engine's pin, a
 * package's codegen and the ext check name every operation alike.
 */
export const toolNamesOf = (documentText: string, crmId: string): ToolNamesReading => {
    if (documentText.length > DOCUMENT_MAX_CHARS) return { ok: false, problem: "too_large", at: null }
    const read = parseJsonText(documentText)
    if (!read.ok) return { ok: false, problem: "not_json", at: null }
    return crmOpsOf(read.value, crmId)
}

/** The text of the generated names file of the CRM `crmId` from a reading that gave names. */
export const toolNamesTextOf = (crmId: string, reading: Extract<CrmOpsReading, { ok: true }>): string =>
    crmNamesTextOf(crmId, reading.basePath, reading.entries)
