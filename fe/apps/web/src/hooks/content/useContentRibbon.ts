"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { WorkbenchFigureData } from "@/modules/types"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import type { ContentWorkbenchData } from "@/modules/content"

/** The four figures of the workbench ribbon, formatted for the reader; only their terms while they are not read. */
export const useContentRibbon = (figures: ContentWorkbenchData["figures"] | undefined): Array<WorkbenchFigureData> => {
    const t = useTranslations("workbenchFigures")
    const format = useFormatter()
    if (!figures)
        return [
            { id: "waiting", term: t("ctWaiting"), value: "" },
            { id: "published", term: t("ctPublished"), value: "" },
            { id: "next", term: t("ctNext"), value: "" },
            { id: "pillars", term: t("ctPillars"), value: "" },
        ]
    return [
        {
            id: "waiting",
            term: t("ctWaiting"),
            value: format.number(figures.awaitingApproval),
            meta: t("ctWaitingMeta"),
        },
        {
            id: "published",
            term: t("ctPublished"),
            value: format.number(figures.published30),
            meta: t("ctPublishedMeta"),
        },
        {
            id: "next",
            term: t("ctNext"),
            value: figures.next
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
            value:
                figures.pillars.total > 0
                    ? `${format.number(figures.pillars.covered)}/${format.number(figures.pillars.total)}`
                    : "-",
            meta: t(figures.pillars.total > 0 ? "ctPillarsMeta" : "ctPillarsNone"),
        },
    ]
}
