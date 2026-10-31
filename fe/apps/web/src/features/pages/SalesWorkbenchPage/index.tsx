import { getTranslations } from "next-intl/server"
import { salesTabOf } from "@/hooks/sales"
import { SalesWorkbenchPageBase } from "./component"

/** What the route passes. */
interface SalesWorkbenchPageProps {
    /** The selected Sales tab. */
    readonly tab?: string | null
    /** The pending decision to highlight. */
    readonly focus?: string | null
    /** `?conversation=` of the route: the thread of a customer to draw. */
    readonly conversation?: string | null
    /** The Sales agent instance the workbench opens for. */
    readonly installationId?: string
}

/** The server shell: resolves the tab from the route, words the tabs and hands the page its ids. */
export const SalesWorkbenchPage = async (props: SalesWorkbenchPageProps) => {
    const t = await getTranslations("workbenchSales")
    const focus = props.focus ?? null
    return (
        <SalesWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                tab: props.conversation ? "conversation" : (salesTabOf(props.tab) ?? (focus ? "decisions" : "attention")),
                focus,
                conversation: props.conversation ?? null,
                tabs: {
                    conversation: t("tab_conversation"),
                    attention: t("tab_attention"),
                    pipeline: t("tab_pipeline"),
                    decisions: t("tab_decisions"),
                    handoff: t("tab_handoff"),
                    contracts: t("tab_contracts"),
                    activity: t("tab_activity"),
                },
            }}
        />
    )
}
