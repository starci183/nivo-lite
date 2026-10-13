import type { ReactNode } from "react"
import { SalesActivity } from "@/components/blocks/SalesActivity"
import { SalesAttention } from "@/components/blocks/SalesAttention"
import { SalesContracts } from "@/components/blocks/SalesContracts"
import { SalesDecisions } from "@/components/blocks/SalesDecisions"
import { SalesHandoffs } from "@/components/blocks/SalesHandoffs"
import { SalesPipeline } from "@/components/blocks/SalesPipeline"
import { SalesWorkbench } from "@/components/blocks/SalesWorkbench"
import { WORKBENCH_CLASS_NAME } from "./classNames"

/** The resolved route state of the Sales workbench. */
interface SalesWorkbenchPageBaseProps {
    readonly props: {
        /** The selected tab. */
        readonly tab: string
        /** The decision to highlight, if any. */
        readonly focus: string | null
    }
}

/** The connected area of one tab; each reads the same workbench in the browser. */
const areaOf = (tab: string, focus: string | null): ReactNode => {
    if (tab === "pipeline") return <SalesPipeline />
    if (tab === "decisions") return <SalesDecisions focusId={focus} />
    if (tab === "handoff") return <SalesHandoffs />
    if (tab === "contracts") return <SalesContracts />
    if (tab === "activity") return <SalesActivity />
    return <SalesAttention />
}

/** The Sales workbench: the connected frame (dashboard, figures, tab strip) and the connected area of the selected tab under it. */
export const SalesWorkbenchPageBase = (props: SalesWorkbenchPageBaseProps) => (
    <div className={WORKBENCH_CLASS_NAME}>
        <SalesWorkbench tab={props.props.tab} />
        {areaOf(props.props.tab, props.props.focus)}
    </div>
)
