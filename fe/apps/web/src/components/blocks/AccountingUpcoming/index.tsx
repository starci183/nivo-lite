"use client"

import { useTranslations } from "next-intl"
import { useAccountingUpcoming, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingUpcomingBase } from "./component"

/** The connected Upcoming card of the Accounting overview: the next tax deadlines and supplier payments. */
export const AccountingUpcoming = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const upcoming = useAccountingUpcoming(workbench.data)
    return (
        <AccountingUpcomingBase
            props={{
                slot: mapSlot(workbench.slot, () => upcoming.props),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: upcoming.props,
            }}
            on={{ ...upcoming.on, retry: workbench.retry }}
        />
    )
}
