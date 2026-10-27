import { Alert, Input } from "@starci/grammar/common"
import { FormDrawer } from "@/components/branches/FormDrawer"

/** The words and state of the shipping drawer. */
export interface SalesShipDrawerProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly closeLabel: string
        readonly saveLabel: string
        readonly cancelLabel: string
        readonly noticeTitle: string
        readonly noticeText: string
        readonly carrierLabel: string
        readonly carrierHint: string
        readonly trackingLabel: string
        readonly carrier: string
        readonly tracking: string
        readonly error: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly carrier: (value: string) => void
        readonly tracking: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** The carrier and tracking code of an order that was handed to a carrier. */
export const SalesShipDrawer = (props: SalesShipDrawerProps) => {
    const { props: p, on } = props
    return (
        <FormDrawer
            isOpen={p.isOpen}
            title={p.title}
            closeLabel={p.closeLabel}
            saveLabel={p.saveLabel}
            cancelLabel={p.cancelLabel}
            error={p.error}
            isPending={p.isPending}
            canSave={p.carrier.trim() !== "" && p.tracking.trim() !== ""}
            onSubmit={on.submit}
            onClose={on.close}
        >
            <Alert tone="informative" title={p.noticeTitle} description={p.noticeText} />
            <Input
                id="ship-carrier"
                name="carrier"
                label={p.carrierLabel}
                description={p.carrierHint}
                value={p.carrier}
                onValueChange={on.carrier}
                isRequired
            />
            <Input
                id="ship-tracking"
                name="tracking"
                label={p.trackingLabel}
                value={p.tracking}
                onValueChange={on.tracking}
                isRequired
            />
        </FormDrawer>
    )
}
