import { getFormatter, getTranslations } from "next-intl/server"
import { salesTabOf } from "@/hooks/sales"
import { salesFiguresOf, withSalesWaiting } from "@/hooks/salesfigures"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { getSession } from "@/lib/session"
import { readSalesWorkbench } from "@/modules/db/sales/read-sales-workbench"
import { SalesWorkbenchPageBase } from "./component"

/** What the route passes. */
interface SalesWorkbenchPageProps {
    /** `?tab=` from the route (attention, pipeline, decisions, handoff, contracts, activity); anything else opens the first tab. */
    readonly tab?: string | null
    /** `?focus=` from the route: the decision a waiting row leads to (opens the Decisions tab on it). */
    readonly focus?: string | null
}

const count = (n: number): string => (n > 0 ? ` (${n})` : "")

/** The Sales workbench slot: reads the flow data and still renders the frame when the tables are not ready. */
export const SalesWorkbenchPage = async (props: SalesWorkbenchPageProps) => {
    const [session, t, format] = await Promise.all([getSession(), getTranslations("workbenchSales"), getFormatter()])
    const workspaceId = session.workspace.id
    const [dashboard, workbench] = await Promise.all([
        loadAgentDashboard("sales", {
            decisionHref: (item) => workbenchHref("sales", { tab: "decisions", focus: item.id }),
        }),
        readSalesWorkbench(workspaceId),
    ])
    const data = workbench.kind === "ok" ? workbench.value : null
    const money = (amount: number | null): string =>
        amount === null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const focus = props.focus ?? null
    const decisions = data?.decisions ?? []
    return (
        <SalesWorkbenchPageBase
            props={{
                dashboard: data === null ? dashboard : withSalesWaiting(dashboard, decisions),
                figures: data === null ? [] : salesFiguresOf(data.metrics, { t, money }),
                data,
                initialTab: salesTabOf(props.tab) ?? (focus ? "decisions" : "attention"),
                focus,
                workspaceId,
                labels: {
                    attention: `${t("tab_attention")}${count(data?.attention.length ?? 0)}`,
                    pipeline: t("tab_pipeline"),
                    decisions: `${t("tab_decisions")}${count(decisions.length)}`,
                    handoff: t("tab_handoff"),
                    contracts: t("tab_contracts"),
                    activity: t("tab_activity"),
                    loadFailedTitle: t("loadFailedTitle"),
                    loadFailedBody: t("loadFailedBody"),
                },
            }}
        />
    )
}
