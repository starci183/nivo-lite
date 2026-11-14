import type { ReactNode } from "react"
import { Badge, Cluster, Stack, Text } from "@starci/grammar/common"
import type { ContactHistoryOrderView } from "@/modules/types"

/** The order a line told. */
interface ThreadOrderCardProps {
    readonly order: ContactHistoryOrderView
}

/**
 * The order card under a line of a thread, read only: the same anatomy as the workbench thread's order card (blocks-core
 * `ThreadOrderCard`) and the team chat's order notice: the order number with whether it was paid (plain badge, no dot), then the order
 * body the registry's view drew (the bordered list of items with photo, name, how many and price, then the total and delivery rows).
 * It carries no pay or confirm control and no card of its own: it stands in the bubble's footer.
 */
export const ThreadOrderCard = (props: ThreadOrderCardProps): ReactNode => (
    <Stack gap="inline">
        <Cluster gap="identity" justify="between" align="center" wrap={false}>
            <Text size="sm" isStrong>
                {props.order.orderNo}
            </Text>
            <Badge tone={props.order.status.isPaid ? "success" : "neutral"}>{props.order.status.label}</Badge>
        </Cluster>
        {props.order.body}
    </Stack>
)
