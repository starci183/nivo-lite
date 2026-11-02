import type { ReactNode } from "react"
import { Link, Stack } from "@starci/grammar/common"

/** The regions of the Automations page body, each already connected to its data. */
type AutomationsPageLayoutProps = {
    readonly board: ReactNode
    readonly advancedLabel: string
    readonly advancedHref: string
}

/** The Automations page body: the board, then the link to Advanced, in one column. */
export const AutomationsPageLayout = (props: AutomationsPageLayoutProps) => (
    <Stack gap="section">
        {props.board}
        <Link href={props.advancedHref}>{props.advancedLabel}</Link>
    </Stack>
)
