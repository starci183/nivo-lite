import type { ReactElement } from "react"
import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"

/** The automations page with no data yet: the same heading and link, the panes as skeletons. */
export const AutomationsLoadingPage = (): ReactElement => (
    <AutomationsHeading>
        <AutomationsBoard layout="page" />
    </AutomationsHeading>
)
