import type { ReactNode } from "react"
import { PageContainer, TextAction } from "@starci/grammar/common"
import { LINK_ROW_CLASS, PAGE_CLASS } from "./classNames"

/** The regions of the Automations page, each already connected to its data. */
type AutomationsPageLayoutProps = {
    readonly heading: ReactNode
    readonly board: ReactNode
    readonly advancedLabel: string
    readonly advancedHref: string
}

/** The Automations page frame: the heading, the board and the link to Advanced in one product-width column. */
export const AutomationsPageLayout = (props: AutomationsPageLayoutProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            {props.heading}
            {props.board}
            <div className={LINK_ROW_CLASS}>
                <TextAction href={props.advancedHref} size="sm" appearance="muted">
                    {props.advancedLabel}
                </TextAction>
            </div>
        </div>
    </PageContainer>
)
