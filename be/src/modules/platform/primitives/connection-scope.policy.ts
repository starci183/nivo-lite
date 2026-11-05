/** True when a value names no connection, or names one together with its workspace (both ids non-empty text). */
export const namesConnectionOrNone = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) return false
    const named = [Reflect.get(value, "connectionId"), Reflect.get(value, "workspaceId")]
    return named.every((id) => id === undefined) || named.every((id) => typeof id === "string" && id.length > 0)
}
