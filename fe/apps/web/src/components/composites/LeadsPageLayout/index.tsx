import type { ReactNode } from "react"
import { PageContainer } from "@starci/grammar/common"
import { PAGE_CLASS_NAME } from "./classNames"

/** The regions of the Leads page, each already connected to its data. */
type LeadsPageLayoutProps = {
    readonly heading: ReactNode
    /** The new-lead form while it is open. */
    readonly form: ReactNode
    readonly board: ReactNode
    /** The promotion row under a non-empty list. */
    readonly promo: ReactNode
}

/** The Leads page frame: the page header, then the optional form, the list and the promotion in one product-width column. */
export const LeadsPageLayout = (props: LeadsPageLayoutProps) => (
    <>
        {props.heading}
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                {props.form}
                {props.board}
                {props.promo}
            </div>
        </PageContainer>
    </>
)
