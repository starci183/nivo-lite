/** One line of an order as a reader sees it. */
export interface OrderLineView {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

const LINE = /^(\d+(?:\.\d+)?) x (.+)$/
const SEPARATOR = ", "

/** The text an order keeps its items in: `2 x tea, 1 x cake`. */
export const itemsTextOf = (lines: ReadonlyArray<OrderLineView>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(SEPARATOR)

/** The lines of an order's text: split into `<qty> x <name>` parts; a part without a quantity counts once. */
export const itemLinesOf = (text: string): ReadonlyArray<OrderLineView> =>
    text
        .split(SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .map((part) =>
            LINE.test(part)
                ? { name: part.replace(LINE, "$2"), qty: Number(part.replace(LINE, "$1")) }
                : { name: part, qty: 1 },
        )

/** One line of an order as a record keeps it: the price and what the line comes to. */
export interface PricedLine extends OrderLineView {
    /** The price of one, VND. */
    readonly unitVnd: number
    /** What the line comes to, VND. */
    readonly amountVnd: number
}

/** The lines a record keeps for the items a customer named; a line named without a price is kept at no price. */
export const pricedLinesOf = (
    lines: ReadonlyArray<OrderLineView & { readonly unitVnd?: number | undefined }>,
): ReadonlyArray<PricedLine> =>
    lines.map((line) => {
        const unitVnd = line.unitVnd ?? 0
        return { name: line.name, qty: line.qty, unitVnd, amountVnd: Math.round(line.qty * unitVnd) }
    })
