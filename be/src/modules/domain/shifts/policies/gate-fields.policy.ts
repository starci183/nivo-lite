import type { GateFieldValue } from "@modules/domain/module-ops"

/** A fact a gated action carried, read as text: a missing or null fact is the empty text. */
export const fieldText = (fields: Readonly<Record<string, GateFieldValue>>, name: string): string => {
    const value = fields[name]
    return value === undefined || value === null ? "" : String(value)
}
