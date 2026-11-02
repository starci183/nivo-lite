import type { SalesShipmentDrawerView, SalesShipmentDrawerActions } from "@/modules/types"
import { Alert, Input } from "@starci/grammar/common"
import { FormDrawer } from "@/components/branches/FormDrawer"
/** Supplies shipment details and editing actions to the carrier drawer. */
interface SalesShipDrawerProps {
    readonly props: SalesShipmentDrawerView
    readonly on: SalesShipmentDrawerActions
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
            fields={
                <>
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
                </>
            }
        />
    )
}
