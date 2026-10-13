import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { LoyaltyWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the loyalty workbench. */
interface LoyaltyWorkbenchPageProps {
    /** `?tab=` of the route (overview, members, rewards, promo, pending); anything else opens the first tab. */
    readonly tab?: string | null
    /** The Loyalty agent instance the workbench opens for. */
    readonly installationId?: string
}

/** /agents/loyalty/workbench: the programme overview, members, rewards, promotions and the decisions waiting for a person. */
export const LoyaltyWorkbenchPage = async (props: LoyaltyWorkbenchPageProps) => {
    if (props.installationId === undefined) notFound()
    const t = await getTranslations("loyalty")
    return (
        <LoyaltyWorkbenchPageBase
            props={{
                installationId: props.installationId,
                initialTab: props.tab ?? null,
                tabs: {
                    overview: t("tab_overview"),
                    members: t("tab_members"),
                    rewards: t("tab_rewards"),
                    promo: t("tab_promo"),
                    pending: t("tab_pending"),
                },
            }}
        />
    )
}
