import type { useTranslations, useFormatter } from "next-intl"
import type { useSalesActions } from "@/hooks/sales"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { useSalesShipmentForm } from "@/hooks/rhf"
import { Alert, Badge, Button, EmptyNotice, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesRow } from "@/components/branches/SalesRow"
import { SalesShipDrawer } from "@/components/composites/SalesShipDrawer"
import type { SalesShipDrawerProps } from "@/components/composites/SalesShipDrawer"

/** One order or won deal and where its invoice stands, every word already resolved. */
export interface HandoffItemView {
    readonly key: string
    readonly orderId: string | null
    readonly orderLabel: string
    readonly orderTone: BadgeTone
    readonly invoiceLabel: string
    readonly invoiceTone: BadgeTone
    readonly confirmed: string | null
    readonly customer: string
    readonly leadHref: string | null
    readonly detail: string
    readonly amount: string
    readonly invoiceLine: string | null
    readonly shippedLine: string | null
    readonly workText: string | null
    readonly errorText: string | null
    readonly hint: string | null
    readonly note: string | null
    readonly error: string | null
    readonly canRun: boolean
    readonly runLabel: string
    readonly canShip: boolean
    readonly isRunBusy: boolean
}

/** The words and data of the hand-off surface. */
export interface SalesHandoffsBaseProps {
    readonly props: {
        readonly label: string
        readonly intro: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly errorLabel: string
        readonly shipLabel: string
        readonly rows: ReadonlyArray<HandoffItemView>
        /** True while a hand-off is in flight: every command waits. */
        readonly isBusy: boolean
        /** The shipping drawer while it is open. */
        readonly ship: SalesShipDrawerProps["props"] | null
    }
    readonly on: {
        readonly run: (key: string, orderId: string) => void
        readonly ship: (key: string) => void
        readonly carrier: (value: string) => void
        readonly tracking: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** Surface 4: confirmed orders and where their invoice stands. A confirmed order with no invoice can be handed to Accounting. */
export const SalesHandoffsBase = (props: SalesHandoffsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <Text size="sm" tone="muted">
                {p.intro}
            </Text>
            <SurfaceListCard
                ariaLabel={p.label}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => renderHandoffRow({ row, p, on }))}
            </SurfaceListCard>
            {p.ship === null ? null : (
                <SalesShipDrawer
                    props={p.ship}
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
                intent="commit"
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

const renderHandoffRow = ({ row, p, on }: RenderHandoffRowInput) => (
    <SalesRow
        key={row.key}
        chips={
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
        }
        customer={row.customer}
        customerHref={row.leadHref}
        actions={renderHandoffActions({ row, p, on })}
    >
        <Text size="sm" tone="muted" overflow="clamp-2">
            {row.detail}
        </Text>
        <Text size="sm" weight="semibold">
            {row.amount}
        </Text>
        {row.invoiceLine === null ? null : (
            <Text size="xs" tone="muted">
                {row.invoiceLine}
            </Text>
        )}
        {row.shippedLine === null ? null : (
            <Text size="sm" weight="medium">
                {row.shippedLine}
            </Text>
        )}
        {row.workText === null ? null : (
            <Text size="sm" weight="medium">
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
            <Text size="sm" weight="medium" live="polite">
                {row.note}
            </Text>
        )}
        {row.error === null ? null : (
            <Text size="sm" live="assertive">
                {row.error}
            </Text>
        )}
    </SalesRow>
)

type RenderHandoffActionsInput = {
    row: HandoffItemView
    p: SalesHandoffsBaseProps["props"]
    on: SalesHandoffsBaseProps["on"]
}

type RenderHandoffRowInput = {
    row: HandoffItemView
    p: SalesHandoffsBaseProps["props"]
    on: SalesHandoffsBaseProps["on"]
}
/** State values and commands consumed by the connected surface. */
export interface Shipping {
    readonly key: string
    readonly orderId: string
    readonly orderNo: string | null
    readonly customer: string
}

/** State values and commands consumed by the connected surface. */
export type SalesHandoffsControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly data: ReturnType<typeof useSalesWorkbench>["data"]
    readonly rows: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["handoffs"]>
    readonly form: ReturnType<typeof useSalesShipmentForm>
    readonly values: { readonly carrier: string; readonly tracking: string }
    readonly busyKey: string | null
    readonly setBusyKey: React.Dispatch<React.SetStateAction<string | null>>
    readonly notes: Readonly<Record<string, string>>
    readonly setNotes: React.Dispatch<React.SetStateAction<Readonly<Record<string, string>>>>
    readonly shipping: Shipping | null
    readonly setShipping: React.Dispatch<React.SetStateAction<Shipping | null>>
}
