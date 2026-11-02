import type { InventoryPendingData, InventoryPendingActions } from "@/modules/types"

/** Resolved pending fields and atomic commands; the module Base owns read status. */
type InventoryPendingProps = InventoryPendingData & {
    readonly isLoading: boolean
    readonly onApprove: InventoryPendingActions["onApprove"]
    readonly onReject: InventoryPendingActions["onReject"]
}

type PendingRowView = InventoryPendingData["rows"][number]
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, EmptyNotice, Quote, Stack, SurfaceCard, Text, type ListRowData, Cluster } from "@starci/grammar/common"

/** One waiting decision as a row: its approve/reject commands and the drafted message under the row. */
const pendingItem = (props: InventoryPendingProps, row: PendingRowView): ListRowData => ({
    id: row.id,
    title: row.summary,
    detail: (
        <Stack gap="inline" align="start">
            <Cluster gap="inline">
                <Button
                    isLoading={props.isLoading}
                    intent="alternative"
                    size="sm"
                    isDisabled={props.isPending}
                    onPress={() => props.onApprove(row.id)}
                >
                    {row.approveLabel}
                </Button>
                <Button
                    isLoading={props.isLoading}
                    intent="alternative"
                    size="sm"
                    isDisabled={props.isPending}
                    onPress={() => props.onReject(row.id)}
                >
                    {props.rejectLabel}
                </Button>
            </Cluster>
            {row.draft === null ? null : <Quote text={row.draft} />}
        </Stack>
    ),
})

/** What waits for the owner: sending an order to a supplier and bigger stock changes. */
export const InventoryPending = (props: InventoryPendingProps) => {
    if (props.rows.length === 0) return null
    return (
        <Stack gap="row">
            <InventoryNotices error={props.error} />
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                label={props.title}
                headingLevel={2}
                fact={`(${props.count})`}
                items={props.rows.map((row) => pendingItem(props, row))}
                empty={<EmptyNotice message={props.title} />}
                footer={
                    <Text size="sm" tone="muted">
                        {props.description}
                    </Text>
                }
            />
        </Stack>
    )
}
