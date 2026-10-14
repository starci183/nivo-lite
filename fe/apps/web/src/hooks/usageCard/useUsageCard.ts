"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { useQueryCreditUsageSummarySwr } from "@/hooks/swr"
import { MODULE_KEYS, pickCopy } from "@/modules/catalog"
import { dayjs, productCalendarDay } from "@/modules/dayjs"
import { navigation } from "@/modules/i18n"
import { creditsPath } from "@/modules/routes"
import { alertOf, dailyOf, factsOf, metersOf } from "./usageCard.shared"
import type { UsageCardView } from "./usageCard.shared"

/** Reads usage and resolves every display label, calculation and navigation action outside the drawing. */
export const useUsageCard = (workspaceId: string | undefined): UsageCardView => {
    const t = useTranslations("billing")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    const router = navigation.useRouter()
    const query = useQueryCreditUsageSummarySwr(workspaceId)
    const catalog = useModuleCatalog()
    const usage = query.data
    const status = usage?.status ?? null
    const moduleLabels: Record<string, string> = {
        ...Object.fromEntries(
            MODULE_KEYS.map((key) => {
                const copy = catalog.modules[key]
                return [key, copy === undefined ? "" : pickCopy(copy.shortName, locale)]
            }),
        ),
        setup: t("modSetup"),
        office: t("modOffice"),
        knowledge: t("modKnowledge"),
        other: t("modOther"),
    }
    let error: string | undefined
    if (query.error) error = query.error instanceof Error ? query.error.message : t("errGeneric")
    if (catalog.slot.isError === true) error ??= t("errGeneric")
    return {
        state: { isLoading: error === undefined && (usage === undefined || catalog.slot.isLoading === true), error },
        props: {
            title: t("usageTitle"),
            description: t("usageText"),
            loading: t("loading"),
            errorTitle: t("errGeneric"),
            empty: t("usageEmpty"),
            modulesTitle: t("usageByModule"),
            alert: alertOf(status, t),
            meters: metersOf(status, t, format),
            facts: factsOf(status, t, format),
            daily: dailyOf(usage, t, format, productCalendarDay(new Date())),
            modules: (usage?.byModule ?? []).map((module) => ({
                id: module.module,
                label: moduleLabels[module.module] ?? module.module,
                reading: t("usageModuleLine", {
                    calls: format.number(module.calls),
                    credits: format.number(Math.round(module.credits)),
                }),
            })),
        },
        on: {
            openCredits: () => router.push(creditsPath()),
            formatDay: (value) =>
                format.dateTime(dayjs.utc(String(value)).toDate(), { day: "numeric", month: "short", timeZone: "UTC" }),
            formatCredits: (value) => (typeof value === "number" ? format.number(Math.round(value)) : ""),
            minimumBarSize: (value) => (typeof value === "number" && value > 0 ? 4 : 0),
        },
    }
}
