import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { invalid, readSeedDocuments } from "./management-seed.policy"
import { RECORDS_SEED_SCHEMA, type SeedRecord } from "./records-seed.contracts"

const ENTITY_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/u
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const scalarOf = (value: unknown, field: string): string | number | boolean | null =>
    value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : invalid(field)

const valuesOf = (raw: unknown): MutationValues => {
    if (!isRecord(raw) || Object.keys(raw).length === 0) return invalid("record.values")
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, scalarOf(value, `record.values.${key}`)]))
}

const recordOf = (raw: unknown): SeedRecord => {
    if (!isRecord(raw)) return invalid("record")
    const { entity, on } = raw
    if (typeof entity !== "string" || !ENTITY_PATTERN.test(entity)) return invalid("record.entity")
    if (typeof on !== "string" || !NAME_PATTERN.test(on)) return invalid("record.on")
    return { entity, on, values: valuesOf(raw.values) }
}

/** The records of the records-seed documents of the stack seed envelope, in order. */
export const readSeedRecords = (text: string): ReadonlyArray<SeedRecord> =>
    readSeedDocuments(text).flatMap((document) => {
        if (!isRecord(document) || document.schema !== RECORDS_SEED_SCHEMA) return invalid("schema")
        return Array.isArray(document.records) && document.records.length > 0
            ? document.records.map((raw) => recordOf(raw))
            : invalid("records")
    })
