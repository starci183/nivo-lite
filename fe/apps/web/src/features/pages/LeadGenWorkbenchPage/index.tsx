import type { Installation } from "@/modules/installations"
import { LeadGenWorkbenchPageBase } from "./component"

/** Route identity passed by the module chrome. */
interface LeadGenWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installation?: Installation | null
}

/** Lead Gen server shell; the connected block reads every workbench region through GraphQL. */
export const LeadGenWorkbenchPage = (props: LeadGenWorkbenchPageProps) => (
    <LeadGenWorkbenchPageBase
        props={{
            tab: props.tab ?? null,
            focus: props.focus ?? null,
            installationId: props.installation?.id ?? null,
            scopeInstallationId: props.installation?.isMulti ? props.installation.id : null,
        }}
    />
)
