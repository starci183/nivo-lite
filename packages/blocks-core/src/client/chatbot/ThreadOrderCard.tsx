import type { ReactNode } from "react"
import { Badge, Cluster, Stack, Text } from "@starci/grammar/common"
import type { MessageOrder } from "../../rows/chatbot/conversation.types"
import { OrderBody } from "../sales/sales-agent-message-views"

/** The words of an order card in a thread. */
export interface ThreadOrderWords {
    /** The label of the total. */
    readonly total: string
    /** The label of the delivery line. */
    readonly deliver: string
    /** The mark of an order that was paid. */
    readonly paid: string
    /** The mark of an order that waits for its payment. */
    readonly pending: string
}

/** The order a message is about, and the words that label it. */
interface ThreadOrderCardProps {
    readonly order: MessageOrder
    readonly words: ThreadOrderWords
}

/**
 * The order card under a message of a thread: the order number with whether it is paid, the items (the photo of each, a sprout while it has
 * none, the name with how many and at what price) and the total and delivery rows. It is the same body the order notice draws in the team chat.
 */
export const ThreadOrderCard = (props: ThreadOrderCardProps): ReactNode => (
    <Stack gap="inline">
        <Cluster gap="inline" justify="between" align="center" wrap={false}>
            <Text size="sm" isStrong>
                {props.order.orderNo}
            </Text>
            <Badge tone={props.order.paid ? "success" : "neutral"}>
                {props.order.paid ? props.words.paid : props.words.pending}
            </Badge>
        </Cluster>
        <OrderBody
            facts={{
                lines: props.order.lines.map((line) => ({
                    name: line.name,
                    qty: line.qty,
                    unitText: line.unitText,
                    amountText: line.amountText,
                    imageUrl: line.imageUrl === "" ? null : line.imageUrl,
                })),
                amountText: props.order.amountText,
                customer: "",
                address: props.order.address,
            }}
            kinds={{ total: props.words.total, customer: "", deliver: props.words.deliver }}
        />
    </Stack>
)
