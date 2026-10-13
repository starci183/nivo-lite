import type { ReactNode } from "react"
import { PageContainer, PrimaryRailLayout } from "@starci/grammar/common"
import { COLUMN_CLASS_NAME, PAGE_CLASS_NAME } from "./classNames"

/** The regions of the lead page, each already connected to its data. */
type LeadPageLayoutProps = {
    readonly header: ReactNode
    readonly primary: ReactNode
    readonly rail: ReactNode
}

/** The lead journey frame: the header, then the primary panels beside the rail panels. */
export const LeadPageLayout = (props: LeadPageLayoutProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            {props.header}
            <PrimaryRailLayout
                railWidth="standard"
                align="start"
                primary={<div className={COLUMN_CLASS_NAME}>{props.primary}</div>}
                rail={<div className={COLUMN_CLASS_NAME}>{props.rail}</div>}
            />
        </div>
    </PageContainer>
)
