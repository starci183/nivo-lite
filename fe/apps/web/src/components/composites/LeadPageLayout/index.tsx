import type { ReactNode } from "react"
import { PrimaryRailLayout, Stack } from "@starci/grammar/common"

/** The regions of the lead page body, each already connected to its data. */
type LeadPageLayoutProps = {
    readonly primary: ReactNode
    readonly rail: ReactNode
}

/** The lead journey body: the primary panels beside the rail panels. */
export const LeadPageLayout = (props: LeadPageLayoutProps) => (
    <PrimaryRailLayout
        railWidth="standard"
        align="start"
        primary={<Stack gap="region">{props.primary}</Stack>}
        rail={<Stack gap="region">{props.rail}</Stack>}
    />
)
