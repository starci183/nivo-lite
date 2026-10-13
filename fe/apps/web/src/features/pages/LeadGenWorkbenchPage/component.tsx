import type { ReactNode } from "react"
import { LeadGenComments } from "@/components/blocks/LeadGenComments"
import { LeadGenHandoffs } from "@/components/blocks/LeadGenHandoffs"
import { LeadGenLeads } from "@/components/blocks/LeadGenLeads"
import { LeadGenSources } from "@/components/blocks/LeadGenSources"
import { LeadGenWorkbench } from "@/components/blocks/LeadGenWorkbench"
import { WORKBENCH_CLASS_NAME } from "./classNames"

/** The resolved route state of the Lead Gen workbench. */
interface LeadGenWorkbenchPageBaseProps {
    readonly props: {
        /** The selected tab. */
        readonly tab: string
        /** The agent the dashboard is read for. */
        readonly installationId: string | null
        /** The agent the workbench is read for: set only when the workspace runs several. */
        readonly workbenchInstallationId: string | null
    }
}

/** The connected area of one tab; each reads the same workbench in the browser. */
const areaOf = (tab: string, installationId: string | null): ReactNode => {
    if (tab === "sources") return <LeadGenSources installationId={installationId} />
    if (tab === "comments") return <LeadGenComments installationId={installationId} />
    if (tab === "handoffs") return <LeadGenHandoffs installationId={installationId} />
    return <LeadGenLeads installationId={installationId} />
}

/** The Lead Gen workbench: the connected frame (dashboard, figures, tab strip) and the connected area of the selected tab under it. */
export const LeadGenWorkbenchPageBase = (props: LeadGenWorkbenchPageBaseProps) => (
    <div className={WORKBENCH_CLASS_NAME}>
        <LeadGenWorkbench
            tab={props.props.tab}
            installationId={props.props.installationId}
            workbenchInstallationId={props.props.workbenchInstallationId}
        />
        {areaOf(props.props.tab, props.props.workbenchInstallationId)}
    </div>
)
