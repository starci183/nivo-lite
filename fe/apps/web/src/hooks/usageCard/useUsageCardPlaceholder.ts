"use client"

import { useFormatter, useTranslations } from "next-intl"
import { productCalendarDay } from "@/modules/dayjs"
import { dailyOf, type UsageCardData } from "./usageCard.shared"

/** The usage card's words with no figures, for a region that draws its skeleton before any read (no data operation runs). */
export const useUsageCardPlaceholder = (): UsageCardData => {
    const t = useTranslations("billing")
    const format = useFormatter()
    return {
        title: t("usageTitle"),
        description: t("usageText"),
        loading: t("loading"),
        empty: t("usageEmpty"),
        modulesTitle: t("usageByModule"),
        alert: null,
        meters: [],
        facts: [],
        modules: [],
        daily: dailyOf(undefined, t, format, productCalendarDay(new Date())),
    }
}
