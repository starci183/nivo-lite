/** True when a returned row carries its id as text. */
const hasTextId = (row: unknown): row is { readonly id: string } =>
    typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"

/** The id of the first row a write returned, or undefined when it returned none (or none that carries an id). */
export const returnedIdOf = (raw: unknown): string | undefined => {
    if (!Array.isArray(raw)) return undefined
    const [row]: ReadonlyArray<unknown> = raw
    return hasTextId(row) ? row.id : undefined
}
