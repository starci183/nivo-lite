import type { GateFieldValue } from "@modules/domain/module-ops"

/** The facts a gated action carried, by name. */
export type GateFields = Readonly<Record<string, GateFieldValue>>

/** A fact read as text: a missing or null fact is the empty text. */
export const fieldText = (fields: GateFields, name: string): string => {
    const value = fields[name]
    return value === undefined || value === null ? "" : String(value)
}

/** A fact read as a number: anything that is not a number is zero. */
export const fieldNumber = (fields: GateFields, name: string): number => Number(fields[name]) || 0
