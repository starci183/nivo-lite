import { LeadGenWorkbench } from "@/components/blocks/LeadGenWorkbench"

/** Route identity of the Lead Gen workbench. */
interface LeadGenWorkbenchPageBaseProps {
    readonly props: {
        readonly tab: string | null
        readonly focus: string | null
        readonly installationId: string | null
        readonly scopeInstallationId: string | null
    }
}

/** The server page shell mounts the connected browser workbench. */
export const LeadGenWorkbenchPageBase = (props: LeadGenWorkbenchPageBaseProps) => <LeadGenWorkbench {...props.props} />
