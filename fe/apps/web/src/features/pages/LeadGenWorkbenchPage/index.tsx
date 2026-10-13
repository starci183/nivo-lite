import { getTranslations } from "next-intl/server"
import { leadGenFiguresOf, leadGenTabOf } from "@/hooks/leadgen"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import type { Installation } from "@/lib/modules-shared"
import { getSession } from "@/lib/session"
import { readLeadGenWorkbench } from "@/modules/db/leadgen/read-lead-gen-workbench"
import { LeadGenWorkbenchPageBase } from "./component"

/** What the route passes. */
interface LeadGenWorkbenchPageProps {
    /** `?tab=` from the route (leads, sources, comments, handoffs); anything else opens the first tab. */
    readonly tab?: string | null
    /** `?focus=` from the route: the comment work item a waiting row leads to (opens the Comments tab on it). */
    readonly focus?: string | null
    /** The Lead Gen agent instance (one per page or ad account): only its prospects, sources and decisions. */
    readonly installation?: Installation | null
}

const count = (n: number): string => (n > 0 ? ` (${n})` : "")

/**
 * The Lead Gen workbench slot: the agent dashboard frame around the four Lead Gen areas. A failed read throws to the route error
 * boundary; a waiting row of the frame opens the Comments tab on that item.
 */
export const LeadGenWorkbenchPage = async (props: LeadGenWorkbenchPageProps) => {
    const installation = props.installation ?? null
    const installationId = installation?.id ?? null
    const [session, t] = await Promise.all([getSession(), getTranslations("workbenchLeadGen")])
    const [dashboard, workbench] = await Promise.all([
        loadAgentDashboard("lead_gen", {
            installationId,
            decisionHref: (item) => workbenchHref("lead_gen", { tab: "comments", focus: item.id, installationId }),
        }),
        readLeadGenWorkbench(session.workspace.id, installation?.isMulti ? installationId : null),
    ])
    if (workbench.kind !== "ok") throw new Error(`lead gen workbench: ${workbench.kind} ${workbench.code}`)
    const data = workbench.value
    const initialTab = leadGenTabOf(props.tab) ?? (props.focus ? "comments" : null)
    return (
        <LeadGenWorkbenchPageBase
            props={{
                dashboard,
                figures: leadGenFiguresOf(data.metrics, t),
                data,
                initialTab,
                labels: {
                    leads: t("tabLeads"),
                    sources: t("tabSources"),
                    comments: `${t("tabComments")}${count(data.comments.length)}`,
                    handoffs: t("tabHandoffs"),
                },
            }}
        />
    )
}
