import { useFormatter, useTranslations } from "next-intl"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import type { ContentWorkbenchData } from "@/modules/content"

/** The four figures of the workbench ribbon, formatted for the reader; empty when they could not be read. */
export const useContentRibbon = (
    figures: ContentWorkbenchData["figures"] | undefined,
): Array<DescriptionListStatItem> => {
    const t = useTranslations("workbenchFigures")
    const format = useFormatter()
    if (!figures) return []
    return [
        {
            id: "waiting",
            term: t("ctWaiting"),
            description: format.number(figures.awaitingApproval),
            meta: t("ctWaitingMeta"),
        },
        {
            id: "published",
            term: t("ctPublished"),
            description: format.number(figures.published30),
            meta: t("ctPublishedMeta"),
        },
        {
            id: "next",
            term: t("ctNext"),
            description: figures.next
                ? format.dateTime(new Date(figures.next.at), {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: PRODUCT_TIME_ZONE,
                  })
                : "-",
            meta: figures.next?.title ?? t("ctNextNoneMeta"),
        },
        {
            id: "pillars",
            term: t("ctPillars"),
            description:
                figures.pillars.total > 0
                    ? `${format.number(figures.pillars.covered)}/${format.number(figures.pillars.total)}`
                    : "-",
            meta: t(figures.pillars.total > 0 ? "ctPillarsMeta" : "ctPillarsNone"),
        },
    ]
}
