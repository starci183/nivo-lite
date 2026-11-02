import { LeadGenWorkbench } from "@/components/blocks/LeadGenWorkbench"

/** Route identity and tab names of the Lead Gen workbench. */
interface LeadGenWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        readonly tabs: {
            readonly leads: string
            readonly sources: string
            readonly comments: string
            readonly handoffs: string
        }
    }
}

/** Draws the Lead Gen workbench: the agent dashboard frame around the prospects, sources, comments and Sales handoffs. */
export const LeadGenWorkbenchPageBase = (props: LeadGenWorkbenchPageBaseProps) => {
    const p = props.props
    return <LeadGenWorkbench installationId={p.installationId} initialTab={p.initialTab} tabs={p.tabs} />
}
