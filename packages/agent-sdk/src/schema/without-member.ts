/**
 * A `z.preprocess` step that drops one retired member of a stored object before its strict schema judges it, so an old row still
 * parses and never keeps the member (the data rights deleted from graph grants and module templates, `nivo-frame.rights`). Anything that
 * is not an object, or has no such member, passes as it is.
 */
export const withoutMember =
    (member: string) =>
    (value: unknown): unknown => {
        if (typeof value !== "object" || value === null || Array.isArray(value) || !(member in value)) return value
        return Object.fromEntries(Object.entries(value).filter(([name]) => name !== member))
    }
