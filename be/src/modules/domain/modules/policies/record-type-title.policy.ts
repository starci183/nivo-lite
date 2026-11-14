/**
 * An English fallback title of a record type, read from its name `<package>.<agent>.<domain>` (or the old `<module>.<thing>`): the last
 * part, capitalised, dashes as blanks (`blocks-core.sales.order-line` is "Order line"). A record type declares no title of its own; the
 * page that shows the deletion warning may map the type id to its own label and use this only when it has none.
 */
export const recordTypeTitleOf = (type: string): string => {
    const last = type.split(".").at(-1) ?? type
    const words = last.replaceAll('-', " ").trim()
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
