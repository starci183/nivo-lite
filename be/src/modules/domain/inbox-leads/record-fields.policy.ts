/** The text of a record field, or null when it is missing or not text. */
export const textOf = (data: Readonly<Record<string, unknown>>, key: string): string | null => {
    const value = data[key]
    return typeof value === "string" ? value : null
}

/** The number of a record field, or null when it is missing or not a finite number (a bigint column may arrive as text). */
export const numberOf = (data: Readonly<Record<string, unknown>>, key: string): number | null => {
    const value = data[key]
    const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether a text is a uuid. */
export const isUuid = (value: string): boolean => UUID.test(value)
