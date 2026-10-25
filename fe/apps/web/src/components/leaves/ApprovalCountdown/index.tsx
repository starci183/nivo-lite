import { RelativeTime, Text } from "@starci/grammar/common"
import type { ApprovalExpiryView } from "@/modules/types"

/** The expiry line resolved by the connected board. */
type ApprovalCountdownProps = {
    readonly expiry: ApprovalExpiryView
}

/** A pure expiry line: Grammar owns its live clock and receives the active locale as data. */
export const ApprovalCountdown = (props: ApprovalCountdownProps) => {
    const expiry = props.expiry
    if (expiry.kind === "none") return null
    if (expiry.kind === "expired")
        return (
            <Text size="sm" tone="muted">
                {expiry.line}
            </Text>
        )
    return <RelativeTime dateTime={expiry.expiresAt} locale={expiry.locale} mode="countdown" fallback="" />
}
