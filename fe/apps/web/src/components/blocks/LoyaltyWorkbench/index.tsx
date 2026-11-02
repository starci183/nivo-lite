"use client"

import { useLoyaltyWorkbenchView } from "@/hooks/loyaltyWorkbench"
import { LoyaltyWorkbenchBase } from "./component"

/** Route atoms supplied by the actual server feature. */
type LoyaltyWorkbenchProps = Parameters<typeof useLoyaltyWorkbenchView>[0]

/** The connected Loyalty world; its twin draws only resolved atom models, slots and actions. */
export const LoyaltyWorkbench = (props: LoyaltyWorkbenchProps) => {
    const view = useLoyaltyWorkbenchView(props)
    return <LoyaltyWorkbenchBase {...view} />
}
