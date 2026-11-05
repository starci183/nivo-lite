/**
 * The value a door answer carries as JSON text (the door sends `data: String!` both ways, so the schema needs no JSON scalar).
 * Malformed text is a transport defect: it throws, and the read or action shows its error state.
 */
export const valueOfJsonText = (text: string): unknown => {
    const value: unknown = JSON.parse(text)
    return value
}
