import {
    Badge,
    Button,
    EmptyNotice,
    HorizontalScrollRegion,
    List,
    ListItem,
    ListRow,
    SurfaceCard,
    SurfaceListCard,
    Text,
    type BadgeTone,
} from "@starci/grammar/common"

import { InventoryNewPoDrawer, type InventoryNewPoDrawerProps } from "@/components/composites/InventoryNewPoDrawer"

import { InventoryPoDrawer, type InventoryPoDrawerProps } from "@/components/composites/InventoryPoDrawer"

import {
    ACTIONS_CLASS_NAME,
    BOARD_CLASS_NAME,
    DETAIL_CLASS_NAME,
    LANE_CLASS_NAME,
    STACK_CLASS_NAME,
} from "./classNames"

/** One order card of a lane, every word already resolved. */
export interface OrderCardView {
    readonly id: string
    readonly poNo: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly supplier: string
    readonly facts: string
    readonly copyNote: string | null
}

/** One lane of the board: a status and its orders. */
export interface OrderLaneView {
    readonly status: string
    readonly label: string
    readonly count: string
    readonly cards: ReadonlyArray<OrderCardView>
}

/** The words and data of the orders tab. */
export interface InventoryOrdersBaseProps {
    readonly props: {
        readonly createLabel: string | null
        readonly openCount: string
        readonly boardLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly openLabel: string
        readonly lanes: ReadonlyArray<OrderLaneView>
        readonly hasOrders: boolean
        /** The order drawer while it is open. */
        readonly poDrawer: InventoryPoDrawerProps["props"] | null
        /** The new order drawer while it is open. */
        readonly newPoDrawer: InventoryNewPoDrawerProps["props"] | null
    }
    readonly on: {
        readonly create: () => void
        readonly open: (id: string) => void
        readonly poSupplier: (value: string) => void
        readonly poExpected: (value: string) => void
        readonly poLine: (index: number, field: "qty" | "cost", value: string) => void
        readonly poInvoice: (value: string) => void
        readonly poMessage: (value: string) => void
        readonly poSaveDraft: () => void
        readonly poSendForApproval: () => void
        readonly poApprove: () => void
        readonly poReject: () => void
        readonly poReceive: () => void
        readonly poRemind: () => void
        readonly poCopy: () => void
        readonly poCancel: () => void
        readonly poClose: () => void
        readonly newSupplier: (value: string) => void
        readonly newPick: (index: number, itemId: string) => void
        readonly newQty: (index: number, value: string) => void
        readonly newCost: (index: number, value: string) => void
        readonly newAddLine: () => void
        readonly newCreate: () => void
        readonly newClose: () => void
    }
}

/** The orders tab: a board with one lane per purchase order status. */
export const InventoryOrdersBase = (props: InventoryOrdersBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS_NAME}>
            <div className={ACTIONS_CLASS_NAME}>
                {p.createLabel === null ? null : (
                    <Button intent="commit" size="sm" onPress={on.create}>
                        {p.createLabel}
                    </Button>
                )}
                <Text size="sm" tone="muted">
                    {p.openCount}
                </Text>
            </div>
            {p.hasOrders ? (
                renderHorizontalScrollRegion(props)
            ) : (
                <SurfaceCard ariaLabel={p.boardLabel}>
                    <EmptyNotice message={p.emptyTitle} description={p.emptyBody} />
                </SurfaceCard>
            )}
            {p.poDrawer === null ? null : (
                <InventoryPoDrawer
                    props={p.poDrawer}
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
            {p.newPoDrawer === null ? null : (
                <InventoryNewPoDrawer
                    props={p.newPoDrawer}
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
        </div>
    )
}

/** Draws the HorizontalScrollRegion section of the current view. */
const renderHorizontalScrollRegion = (props: InventoryOrdersBaseProps) => {
    const { props: p, on } = props
    return (
        <HorizontalScrollRegion overflow="needed" aria-label={p.boardLabel}>
            <List className={BOARD_CLASS_NAME} label={p.boardLabel}>
                {p.lanes.map((lane) => (
                    <ListItem key={lane.status} className={LANE_CLASS_NAME}>
                        <SurfaceListCard label={lane.label} headingLevel={3} fact={lane.count}>
                            {lane.cards.map((card) => (
                                <ListRow
                                    key={card.id}
                                    title={card.poNo}
                                    description={card.supplier}
                                    badges={
                                        <Badge tone={card.statusTone} isDot>
                                            {card.statusLabel}
                                        </Badge>
                                    }
                                    actions={
                                        <Button intent="neutral" size="sm" onPress={() => on.open(card.id)}>
                                            {p.openLabel}
                                        </Button>
                                    }
                                >
                                    <div className={DETAIL_CLASS_NAME}>
                                        <Text size="xs" tone="muted">
                                            {card.facts}
                                        </Text>
                                        {card.copyNote === null ? null : (
                                            <Text size="xs" tone="muted">
                                                {card.copyNote}
                                            </Text>
                                        )}
                                    </div>
                                </ListRow>
                            ))}
                        </SurfaceListCard>
                    </ListItem>
                ))}
            </List>
        </HorizontalScrollRegion>
    )
}
