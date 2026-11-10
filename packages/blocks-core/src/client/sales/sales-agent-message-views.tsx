import type { ReactNode } from "react"
import { Avatar, Cluster, Inset, Stack, Text } from "@starci/grammar/common"
import { orderSummaryKind, paymentReceivedKind } from "../../modules/sales/agent-message-kinds"
import type { OrderSummaryLine } from "../../modules/sales/agent-message-kinds"
import type { AgentMessageView, AgentMessageViewContext } from "../agent-message/agent-message-views"

/** The facts of an order the body draws as key/value rows. */
interface OrderFigures {
    readonly amountText: string
    readonly customer: string
    readonly address: string
}

/** The facts of an order the body draws: its lines, then its figures. */
interface OrderFacts extends OrderFigures {
    readonly lines: ReadonlyArray<OrderSummaryLine>
}

/** One ordered item of the list. */
interface OrderLineRowProps {
    readonly line: OrderSummaryLine
}

/** The labels the key/value rows of an order body carry. */
export interface OrderKindWords {
    readonly total: string
    readonly customer: string
    readonly deliver: string
}

/** The order body and where its words come from. */
interface OrderBodyProps {
    readonly facts: OrderFacts
    readonly kinds: OrderKindWords
}

/** "x 2 · 120.000 VND": how many and the price of one, muted under the item name; what is not known is left out. */
const quantityTextOf = (line: OrderSummaryLine): string =>
    [`\u00d7 ${String(line.qty)}`, line.unitText ?? ""].filter((part) => part !== "").join(" \u00b7 ")

/** One ordered item: the photo of the catalogue item (a neutral tile with the item's initials when there is none), its name with how many and at what price under it, and the amount of the line at the end. */
const OrderLineRow = (props: OrderLineRowProps): ReactNode => {
    const { line } = props
    const image = line.imageUrl ?? ""
    return (
        <Cluster gap="row" justify="between" align="center" wrap={false}>
            <Cluster gap="row" align="center" wrap={false}>
                <Avatar
                    name={line.name}
                    {...(image === "" ? {} : { src: image })}
                    size="lg"
                    shape="rounded"
                    isDecorative
                />
                <Stack gap="identity">
                    <Text size="sm">{line.name}</Text>
                    <Text size="sm" tone="muted">
                        {quantityTextOf(line)}
                    </Text>
                </Stack>
            </Cluster>
            {line.amountText === undefined || line.amountText === "" ? null : (
                <Text size="sm" isStrong>
                    {line.amountText}
                </Text>
            )}
        </Cluster>
    )
}

/** One small fact of an order: its term muted at the start, its value after it. */
interface OrderFact {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly isStrong: boolean
}

/** The facts under the lines: the total (strong), the customer and the delivery; a fact that is not known has no row. */
const factItemsOf = (facts: OrderFigures, kinds: OrderKindWords): ReadonlyArray<OrderFact> =>
    [
        { id: "total", term: kinds.total, value: facts.amountText, isStrong: true },
        { id: "customer", term: kinds.customer, value: facts.customer, isStrong: false },
        { id: "deliver", term: kinds.deliver, value: facts.address, isStrong: false },
    ].filter((row) => row.value !== "")

/** Each line with a key that stays the same for the same line: its name, then how many identical names come before it. */
const keyedLines = (
    lines: ReadonlyArray<OrderSummaryLine>,
): ReadonlyArray<{ readonly key: string; readonly line: OrderSummaryLine }> =>
    lines.map((line, index) => ({
        key: `${line.name}#${String(lines.slice(0, index).filter((before) => before.name === line.name).length)}`,
        line,
    }))

/** The body of an order message: a nested framed list with one row per ordered item, then the key/value rows. */
export const OrderBody = (props: OrderBodyProps): ReactNode => {
    const items = factItemsOf(props.facts, props.kinds)
    return (
        <Stack gap="row">
            {props.facts.lines.length === 0 ? null : (
                <Inset>
                    <Stack gap="inline">
                        {keyedLines(props.facts.lines).map((entry) => (
                            <OrderLineRow key={entry.key} line={entry.line} />
                        ))}
                    </Stack>
                </Inset>
            )}
            {items.length === 0 ? null : (
                <Stack gap="identity">
                    {items.map((item) => (
                        <Cluster key={item.id} gap="inline" align="baseline" wrap={false}>
                            <Text size="xs" tone="muted">
                                {item.term}
                            </Text>
                            <Text size="sm" isStrong={item.isStrong}>
                                {item.value}
                            </Text>
                        </Cluster>
                    ))}
                </Stack>
            )}
        </Stack>
    )
}

/** The summary of an order: its lines with photo and price, then the total, the customer and the place of delivery. */
const orderPreview = (payload: unknown, context: AgentMessageViewContext): ReactNode => {
    const parsed = orderSummaryKind.payload.safeParse(payload)
    return parsed.success ? <OrderBody facts={parsed.data} kinds={context.words.kinds} /> : null
}

/** The money that paid an order: the amount as the total, with the order's items, customer and delivery when the message carries them. */
const paymentPreview = (payload: unknown, context: AgentMessageViewContext): ReactNode => {
    const parsed = paymentReceivedKind.payload.safeParse(payload)
    if (!parsed.success) return null
    const { lines, amountText, customer, address } = parsed.data
    return (
        <OrderBody
            facts={{ lines: lines ?? [], amountText, customer: customer ?? "", address: address ?? "" }}
            kinds={context.words.kinds}
        />
    )
}

/** The views of the kinds the sales and payment flows register. */
export const salesAgentMessageViews: ReadonlyArray<AgentMessageView> = [
    { kind: orderSummaryKind, preview: orderPreview },
    { kind: paymentReceivedKind, preview: paymentPreview },
]
