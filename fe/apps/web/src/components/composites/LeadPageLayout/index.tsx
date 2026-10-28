import type { ReactNode } from "react"
import { PrimaryRailLayout } from "@starci/grammar/common"
import { COLUMN_CLASS_NAME } from "./classNames"

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
        primary={<div className={COLUMN_CLASS_NAME}>{props.primary}</div>}
        rail={<div className={COLUMN_CLASS_NAME}>{props.rail}</div>}
    />
)
