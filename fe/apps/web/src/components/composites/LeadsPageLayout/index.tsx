import { Stack } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The regions of the Leads page body, each already connected to its data. */
type LeadsPageLayoutProps = {
    /** The new-lead form while it is open. */
    readonly form: ReactNode
    readonly board: ReactNode
    /** The promotion row under a non-empty list. */
    readonly promo: ReactNode
}

/** The Leads page body: the optional form, the list and the promotion in one column. */
export const LeadsPageLayout = (props: LeadsPageLayoutProps) => (
    <Stack gap="region">
        {props.form}
        {props.board}
        {props.promo}
    </Stack>
)
