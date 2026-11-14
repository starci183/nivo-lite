import { useState, type ReactNode } from "react"
import { Badge, Dialog, ListBox, SearchField, Stack, Text, type ListBoxItem } from "@starci/grammar/common"
import { rankedOrders, type OpenOrderRow, type RankedOrder } from "../../rules/sales/ledger/open-orders"
import { chosenRow } from "../../rows/rows"

/** The words of the picker. */
export interface OrderPickerWords {
    /** The heading of the overlay. */
    readonly title: string
    /** The name and placeholder of the search field. */
    readonly searchLabel: string
    /** The name of the clear button of the search. */
    readonly clearLabel: string
    /** What the list says when no order fits. */
    readonly emptyBody: string
    /** The name of the close control. */
    readonly closeLabel: string
    /** The mark of an order for the same amount. */
    readonly exact: string
    /** The mark of an order for a near amount. */
    readonly near: string
}

/** What the picker takes. */
export interface OrderPickerProps {
    /** Whether the overlay is open. */
    readonly isOpen: boolean
    /** Called when the person leaves the overlay without choosing. */
    readonly onClose: () => void
    /** The orders that wait for money. */
    readonly options: ReadonlyArray<OpenOrderRow>
    /** Whether the orders are still being read. */
    readonly isLoading: boolean
    /** The amount of the payment in VND, which the orders are ranked by. */
    readonly paymentVnd: number
    /** The words of the overlay. */
    readonly words: OrderPickerWords
    /** Called with the id of the order the person chose. */
    readonly onChoose: (id: string) => void
}

/** The row of the list for one order: its title, the amount at the end, and a mark when the amount is the payment's or near it. */
const itemOf = (order: RankedOrder, words: OrderPickerWords): ListBoxItem => ({
    id: order.id,
    label: order.title,
    trailing: (
        <Stack gap="inline" align="end">
            <Text size="sm" tone="muted">
                {order.amount}
            </Text>
            {order.match === "other" ? null : (
                <Badge tone={order.match === "exact" ? "success" : "neutral"}>
                    {order.match === "exact" ? words.exact : words.near}
                </Badge>
            )}
        </Stack>
    ),
})

/** The overlay that picks the order a payment is assigned to: the orders that wait for money, searchable, the closest amount first. */
export const OrderPicker = (props: OrderPickerProps): ReactNode => {
    const [query, setQuery] = useState("")
    const ranked = rankedOrders(props.options, props.paymentVnd, query)
    return (
        <Dialog
            isOpen={props.isOpen}
            onOpenChange={(open) => {
                if (!open) props.onClose()
            }}
            title={props.words.title}
            closeLabel={props.words.closeLabel}
            isLoading={props.isLoading}
        >
            <Stack gap="row">
                <SearchField
                    label={props.words.searchLabel}
                    isLabelHidden
                    placeholder={props.words.searchLabel}
                    clearLabel={props.words.clearLabel}
                    value={query}
                    onValueChange={setQuery}
                    onClear={() => setQuery("")}
                />
                {ranked.length === 0 ? (
                    <Text size="sm" tone="muted">
                        {props.words.emptyBody}
                    </Text>
                ) : (
                    <ListBox
                        label={props.words.title}
                        items={ranked.map((order) => itemOf(order, props.words))}
                        selectionMode="single"
                        selectionIndicator="none"
                        selectedIds={[]}
                        onSelectionChange={(ids) => {
                            const id = chosenRow(ids)
                            if (id !== null) props.onChoose(id)
                        }}
                    />
                )}
            </Stack>
        </Dialog>
    )
}
