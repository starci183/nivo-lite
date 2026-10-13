import { getTranslations } from "next-intl/server"
import { leadGenTabOf } from "@/hooks/leadgen"
import { LeadGenWorkbenchPageBase } from "./component"

/** Route identity passed by the agent workbench route. */
interface LeadGenWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    /** The Lead Gen instance the workbench opens for; Lead Gen is multi-instance, so it also scopes the data. */
    readonly installationId?: string
}

/** Lead Gen server shell: words the tabs and hands the page the ids; every panel reads its own data in the browser. */
export const LeadGenWorkbenchPage = async (props: LeadGenWorkbenchPageProps) => {
    const t = await getTranslations("workbenchLeadGen")
    return (
        <LeadGenWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                initialTab: leadGenTabOf(props.tab) ?? (props.focus ? "comments" : null),
                tabs: {
                    leads: t("tabLeads"),
                    sources: t("tabSources"),
                    comments: t("tabComments"),
                    handoffs: t("tabHandoffs"),
                },
            }}
        />
    )
}
