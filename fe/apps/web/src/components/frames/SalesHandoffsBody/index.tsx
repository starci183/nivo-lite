import type { HandoffItemView, SalesHandoffsView, SalesHandoffsActions } from "@/modules/types"
import type { ListRowData } from "@starci/grammar/common"
import { Alert, Badge, Button, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import { SalesRow } from "@/components/branches/SalesRow"
import { SalesShipDrawer } from "@/components/composites/SalesShipDrawer"
/** Supplies order handoffs and their accounting and shipping actions. */
interface SalesHandoffsBodyProps extends SalesHandoffsView {
    readonly on: SalesHandoffsActions
}
/** Surface 4: confirmed orders and where their invoice stands. A confirmed order with no invoice can be handed to Accounting. */
export const SalesHandoffsBody = (props: SalesHandoffsBodyProps) => {
    const on = props.on
    return (
        <>
            <Text size="sm" tone="muted">
                {props.intro}
            </Text>
            <SurfaceCard
                kind="list"
                ariaLabel={props.label}
                empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
                items={props.rows.map((row) => renderHandoffRow({ row, p: props, on }))}
            />
            {props.ship === null ? null : (
                <SalesShipDrawer
                    props={props.ship}
                    on={{ carrier: on.carrier, tracking: on.tracking, submit: on.submit, close: on.close }}
                />
            )}
        </>
    )
}
const renderHandoffActions = ({ row, p, on }: RenderHandoffActionsInput) => (
    <>
        {row.canRun && row.orderId !== null ? (
            <Button
                intent="neutral"
                size="sm"
                isPending={row.isRunBusy}
                isDisabled={p.isBusy}
                onPress={() => on.run(row.key, row.orderId ?? "")}
            >
                {row.runLabel}
            </Button>
        ) : null}
        {row.canShip ? (
            <Button intent="neutral" size="sm" onPress={() => on.ship(row.key)}>
                {p.shipLabel}
            </Button>
        ) : null}
    </>
)
const renderHandoffRow = ({ row, p, on }: RenderHandoffRowInput): ListRowData => ({
    id: row.key,
    title: row.customer,
    state: "neutral",
    ...(row.leadHref === null || row.customer === "" ? {} : { href: row.leadHref }),
    detail: (
        <SalesRow
            {...{
                chips: (
                    <>
                        <Badge tone={row.orderTone}>{row.orderLabel}</Badge>
                        <Badge tone={row.invoiceTone} isDot>
                            {row.invoiceLabel}
                        </Badge>
                        {row.confirmed === null ? null : (
                            <Text as="span" size="xs" tone="muted">
                                {row.confirmed}
                            </Text>
                        )}
                    </>
                ),
                actions: renderHandoffActions({ row, p, on }),
                body: (
                    <>
                        <Text size="sm" tone="muted" overflow="clamp-2">
                            {row.detail}
                        </Text>
                        <Text size="sm" isStrong>
                            {row.amount}
                        </Text>
                        {row.invoiceLine === null ? null : (
                            <Text size="xs" tone="muted">
                                {row.invoiceLine}
                            </Text>
                        )}
                        {row.shippedLine === null ? null : (
                            <Text size="sm" isStrong>
                                {row.shippedLine}
                            </Text>
                        )}
                        {row.workText === null ? null : (
                            <Text size="sm" isStrong>
                                {row.workText}
                            </Text>
                        )}
                        {row.errorText === null ? null : (
                            <Alert tone="negative" urgency="polite" title={p.errorLabel} description={row.errorText} />
                        )}
                        {row.hint === null ? null : (
                            <Text size="sm" tone="muted">
                                {row.hint}
                            </Text>
                        )}
                        {row.note === null ? null : (
                            <Text size="sm" isStrong live="polite">
                                {row.note}
                            </Text>
                        )}
                        {row.error === null ? null : (
                            <Text size="sm" live="assertive">
                                {row.error}
                            </Text>
                        )}
                    </>
                ),
            }}
        />
    ),
})
type RenderHandoffActionsInput = {
    row: HandoffItemView
    p: SalesHandoffsBodyProps
    on: SalesHandoffsBodyProps["on"]
}
type RenderHandoffRowInput = {
    row: HandoffItemView
    p: SalesHandoffsBodyProps
    on: SalesHandoffsBodyProps["on"]
}
