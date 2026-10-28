import type { ReactNode } from "react"
import { TextAction } from "@starci/grammar/common"
import { LINK_ROW_CLASS, PAGE_CLASS } from "./classNames"

/** The regions of the Automations page body, each already connected to its data. */
type AutomationsPageLayoutProps = {
    readonly board: ReactNode
    readonly advancedLabel: string
    readonly advancedHref: string
}

/** The Automations page body: the board, then the link to Advanced, in one column. */
export const AutomationsPageLayout = (props: AutomationsPageLayoutProps) => (
    <div className={PAGE_CLASS}>
        {props.board}
        <div className={LINK_ROW_CLASS}>
            <TextAction href={props.advancedHref} size="sm" appearance="muted">
                {props.advancedLabel}
            </TextAction>
        </div>
    </div>
)
