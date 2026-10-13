import { getTranslations } from "next-intl/server"
import { OverviewLoadingPageBase } from "./component"

/** The overview while its data is unresolved: the real headings and labels with skeleton content. */
export const OverviewLoadingPage = async () => {
    const t = await getTranslations("overview")
    return (
        <OverviewLoadingPageBase
            props={{
                eyebrow: t("eyebrow"),
                blocks: [
                    { id: "sum", title: t("sumTitle"), description: t("motto"), lines: 3 },
                    { id: "results", title: t("resultsTitle"), description: t("resultsIntro"), lines: 6 },
                    { id: "waiting", title: t("waitingTitle"), description: null, lines: 2 },
                    { id: "exceptions", title: t("exceptionsTitle"), description: null, lines: 2 },
                    { id: "history", title: t("historyTitle"), description: null, lines: 4 },
                ],
                ownerBelowTitle: t("ownerBelow"),
                kpiLabel: t("kpiAria"),
                kpiLabels: [t("kpiOpen"), t("kpiWaiting"), t("kpiToday"), t("kpiOverdue"), t("kpiLeads")],
                byOwnerTitle: t("byOwner"),
                listLabel: t("byOwner"),
            }}
        />
    )
}
