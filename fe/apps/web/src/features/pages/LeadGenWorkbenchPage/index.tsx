import { leadGenTabOf } from "@/hooks/leadgen"
import type { Installation } from "@/lib/modules-shared"
import { LeadGenWorkbenchPageBase } from "./component"

/** Static route state passed to the connected browser workbench. */
interface LeadGenWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installation?: Installation | null
}

/** The server shell: resolves the tab and the agent from the route and hands the connected workbench its state. */
export const LeadGenWorkbenchPage = (props: LeadGenWorkbenchPageProps) => (
    <LeadGenWorkbenchPageBase
        props={{
            tab: leadGenTabOf(props.tab) ?? (props.focus ? "comments" : "leads"),
            installationId: props.installation?.id ?? null,
            workbenchInstallationId: props.installation?.isMulti ? props.installation.id : null,
        }}
    />
)
