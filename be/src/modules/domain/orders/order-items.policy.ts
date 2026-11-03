/** One line of an order as a node sees it. */
export interface OrderLineView {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

/** One line of an order a node records. */
export interface OrderLineInput extends OrderLineView {
    /** The price of one, VND; not kept in the text. */
    readonly unitPriceVnd?: number | undefined
    /** The catalogue item; not kept in the text. */
    readonly catalogueItemId?: string | undefined
}

const LINE = /^(\d+(?:\.\d+)?) x (.+)$/
const SEPARATOR = ", "

/**
 * The text an order keeps its items in: `2 x tea, 1 x cake`, then the customer's note (an address) on a second line when there is
 * one. The order table has one text column for what was ordered, so both go there.
 */
export const itemsTextOf = (lines: ReadonlyArray<OrderLineInput>, note: string | null): string => {
    const text = lines.map((line) => `${String(line.qty)} x ${line.name}`).join(SEPARATOR)
    return note === null || note === "" ? text : `${text}\n${note}`
}

/** The lines of an order's text: its first line split into `<qty> x <name>` parts; a part without a quantity counts once. */
export const itemLinesOf = (text: string): ReadonlyArray<OrderLineView> =>
    text
        .replace(/\n[\s\S]*$/, "")
        .split(SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .map((part) =>
            LINE.test(part)
                ? { name: part.replace(LINE, "$2"), qty: Number(part.replace(LINE, "$1")) }
                : { name: part, qty: 1 },
        )
