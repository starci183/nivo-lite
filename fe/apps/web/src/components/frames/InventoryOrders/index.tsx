import type { InventoryOrdersData, InventoryOrdersActions } from "@/modules/types"

/** Resolved orders fields and atomic commands; the module Base owns read status. */
type InventoryOrdersProps = InventoryOrdersData & {
    readonly isLoading: boolean
    readonly onCreate: InventoryOrdersActions["onCreate"]
    readonly onOpen: InventoryOrdersActions["onOpen"]
    readonly onPoSupplier: InventoryOrdersActions["onPoSupplier"]
    readonly onPoExpected: InventoryOrdersActions["onPoExpected"]
    readonly onPoLine: InventoryOrdersActions["onPoLine"]
    readonly onPoInvoice: InventoryOrdersActions["onPoInvoice"]
    readonly onPoMessage: InventoryOrdersActions["onPoMessage"]
    readonly onPoSaveDraft: InventoryOrdersActions["onPoSaveDraft"]
    readonly onPoSendForApproval: InventoryOrdersActions["onPoSendForApproval"]
    readonly onPoApprove: InventoryOrdersActions["onPoApprove"]
    readonly onPoReject: InventoryOrdersActions["onPoReject"]
    readonly onPoReceive: InventoryOrdersActions["onPoReceive"]
    readonly onPoRemind: InventoryOrdersActions["onPoRemind"]
    readonly onPoCopy: InventoryOrdersActions["onPoCopy"]
    readonly onPoCancel: InventoryOrdersActions["onPoCancel"]
    readonly onPoClose: InventoryOrdersActions["onPoClose"]
    readonly onNewSupplier: InventoryOrdersActions["onNewSupplier"]
    readonly onNewPick: InventoryOrdersActions["onNewPick"]
    readonly onNewQty: InventoryOrdersActions["onNewQty"]
    readonly onNewCost: InventoryOrdersActions["onNewCost"]
    readonly onNewAddLine: InventoryOrdersActions["onNewAddLine"]
    readonly onNewCreate: InventoryOrdersActions["onNewCreate"]
    readonly onNewClose: InventoryOrdersActions["onNewClose"]
}

type OrderCardView = InventoryOrdersData["lanes"][number]["cards"][number]
import {
    Button,
    Cluster,
    EmptyNotice,
    HorizontalScrollRegion,
    Stack,
    SurfaceCard,
    Text,
    type ListRowData,
} from "@starci/grammar/common"
import { InventoryNewPoDrawer } from "@/components/composites/InventoryNewPoDrawer"
import { InventoryPoDrawer } from "@/components/composites/InventoryPoDrawer"
import { LANE_CLASS_NAME } from "./classNames"

/** The orders tab: a board with one lane per purchase order status. */
export const InventoryOrders = (props: InventoryOrdersProps) => {
    const on = { create: props.onCreate }
    return (
        <Stack gap="row">
            <Cluster gap="inline">
                {props.createLabel === null ? null : (
                    <Button isLoading={props.isLoading} intent="commit" size="sm" onPress={on.create}>
                        {props.createLabel}
                    </Button>
                )}
                <Text size="sm" tone="muted">
                    {props.openCount}
                </Text>
            </Cluster>
            {props.hasOrders ? (
                renderHorizontalScrollRegion(props)
            ) : (
                <SurfaceCard isLoading={props.isLoading} ariaLabel={props.boardLabel}>
                    <EmptyNotice message={props.emptyTitle} description={props.emptyBody} />
                </SurfaceCard>
            )}
            <OrderDrawers {...props} />
        </Stack>
    )
}

/** Draws the HorizontalScrollRegion section of the current view. */
const renderHorizontalScrollRegion = (props: InventoryOrdersProps) => {
    return (
        <HorizontalScrollRegion overflow="needed" aria-label={props.boardLabel}>
            <Cluster gap="row" wrap={false} align="start">
                {props.lanes.map((lane) => (
                    <div key={lane.status} className={LANE_CLASS_NAME}>
                        <SurfaceCard
                            isLoading={props.isLoading}
                            kind="list"
                            label={lane.label}
                            headingLevel={3}
                            fact={lane.count}
                            items={lane.cards.map((card) => itemOf(card, props))}
                            empty={<EmptyNotice message={lane.label} />}
                        />
                    </div>
                ))}
            </Cluster>
        </HorizontalScrollRegion>
    )
}

/** One order card as item data: the status badge, the open action and the facts under the copy. */
const itemOf = (card: OrderCardView, props: InventoryOrdersProps): ListRowData => ({
    id: card.id,
    title: card.poNo,
    description: card.supplier,
    badges: [{ label: card.statusLabel, tone: card.statusTone, isDot: true }],
    action: { label: props.openLabel, intent: "neutral", press: () => props.onOpen(card.id) },
    detail: (
        <Stack gap="identity">
            <Text size="xs" tone="muted">
                {card.facts}
            </Text>
            {card.copyNote === null ? null : (
                <Text size="xs" tone="muted">
                    {card.copyNote}
                </Text>
            )}
        </Stack>
    ),
})

/** The purchase-order and new-order drawers retain their own data and every original command. */
const OrderDrawers = (props: Omit<InventoryOrdersProps, "isLoading">) => {
    const on = {
        create: props.onCreate,
        open: props.onOpen,
        poSupplier: props.onPoSupplier,
        poExpected: props.onPoExpected,
        poLine: props.onPoLine,
        poInvoice: props.onPoInvoice,
        poMessage: props.onPoMessage,
        poSaveDraft: props.onPoSaveDraft,
        poSendForApproval: props.onPoSendForApproval,
        poApprove: props.onPoApprove,
        poReject: props.onPoReject,
        poReceive: props.onPoReceive,
        poRemind: props.onPoRemind,
        poCopy: props.onPoCopy,
        poCancel: props.onPoCancel,
        poClose: props.onPoClose,
        newSupplier: props.onNewSupplier,
        newPick: props.onNewPick,
        newQty: props.onNewQty,
        newCost: props.onNewCost,
        newAddLine: props.onNewAddLine,
        newCreate: props.onNewCreate,
        newClose: props.onNewClose,
    }
    return (
        <>
            {props.poDrawer === null ? null : (
                <InventoryPoDrawer
                    props={props.poDrawer}
                    on={{
                        supplier: on.poSupplier,
                        expected: on.poExpected,
                        line: on.poLine,
                        invoice: on.poInvoice,
                        message: on.poMessage,
                        saveDraft: on.poSaveDraft,
                        sendForApproval: on.poSendForApproval,
                        approve: on.poApprove,
                        reject: on.poReject,
                        receive: on.poReceive,
                        remind: on.poRemind,
                        copy: on.poCopy,
                        cancel: on.poCancel,
                        close: on.poClose,
                    }}
                />
            )}
            {props.newPoDrawer === null ? null : (
                <InventoryNewPoDrawer
                    props={props.newPoDrawer}
                    on={{
                        supplier: on.newSupplier,
                        pick: on.newPick,
                        qty: on.newQty,
                        cost: on.newCost,
                        addLine: on.newAddLine,
                        create: on.newCreate,
                        close: on.newClose,
                    }}
                />
            )}
        </>
    )
}
