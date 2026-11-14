/** The most items of content one approval card carries (agent-sdk `approval.decision` `content`). */
export const APPROVAL_CONTENT_ITEMS_MAX = 20

/** The longest value of one item: the customer send's own text maximum (agent-sdk `APPROVAL_CONTENT_MAX`). */
export const APPROVAL_CONTENT_VALUE_MAX = 4000

/** One piece of what a person approves, shown in full: words, or the address of a file the call sends. */
export interface ApprovalContentItem {
    /** The argument member it comes from. */
    readonly name: string
    /** `text`: words; `address`: where a picture or file is. */
    readonly kind: "text" | "address"
    /** The words, or the address. */
    readonly value: string
}

/** True for a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The items one member of the arguments holds: its words when it is text, the address of each element that carries one when it is a list. */
const itemsOf = (name: string, value: unknown): ReadonlyArray<ApprovalContentItem> => {
    if (typeof value === "string") return value === "" ? [] : [{ name, kind: "text", value }]
    if (!Array.isArray(value)) return []
    return value.flatMap((element: unknown): ReadonlyArray<ApprovalContentItem> => {
        const url: unknown = isRecord(element) ? element.url : undefined
        return typeof url === "string" && url !== "" ? [{ name, kind: "address", value: url }] : []
    })
}

/**
 * What a person approves of a call, IN FULL: the members of the arguments the tool's declaration marks (`ToolSpec.approvalContent`),
 * read by shape alone (a string is words, a list of `{ url }` is addresses), never cut to a fact's width. Bounded only by the card's own
 * limits (the tool's maximum for one value, a count of items), so a card always passes its schema.
 */
export const approvalContentOf = (args: unknown, members: ReadonlyArray<string>): ReadonlyArray<ApprovalContentItem> => {
    if (!isRecord(args)) return []
    return members
        .flatMap((member) => itemsOf(member, args[member]))
        .slice(0, APPROVAL_CONTENT_ITEMS_MAX)
        .map((item) => ({ ...item, value: item.value.slice(0, APPROVAL_CONTENT_VALUE_MAX) }))
}
