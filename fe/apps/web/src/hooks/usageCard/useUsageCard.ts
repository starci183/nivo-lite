"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { slotOfReads } from "@/hooks/slot"
import { useQueryCreditUsageSummarySwr } from "@/hooks/swr"
import { MODULE_KEYS, pickCopy } from "@/modules/catalog"
import { dayjs, productCalendarDay } from "@/modules/dayjs"
import { navigation } from "@/modules/i18n"
import { creditsPath, workspaceHref } from "@/modules/routes"
import { creditsFigureShown, creditsUsedShown } from "@/modules/utils"
import { alertOf, dailyOf, factsOf, metersOf, type UsageCardData, type UsageCardView } from "./usageCard.shared"

/** A credit figure as text: whole numbers, and "<1" for what is under half a credit. */
const creditsTextOf = (exact: number, format: ReturnType<typeof useFormatter>): string => {
    const shown = creditsFigureShown(exact)
    return typeof shown === "number" ? format.number(shown) : shown
}

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
        intent: t("modIntent"),
        dossier_review: t("modDossierReview"),
        public_documents: t("modPublicDocuments"),
        "engine:step-trouble": t("modStepTrouble"),
        "engine:approval-brief": t("modApprovalBrief"),
    }
    const data: UsageCardData = {
        title: t("usageTitle"),
        description: t("usageText"),
        loading: t("loading"),
        empty: t("usageEmpty"),
        modulesTitle: t("usageByModule"),
        alert: alertOf(status, t),
        meters: metersOf(status, t, format),
        facts: factsOf(status, t, format),
        daily: dailyOf(usage, t, format, productCalendarDay(new Date())),
        modules: (usage?.byModule ?? []).map((module) => ({
            id: module.module,
            label: moduleLabels[module.module] ?? t("modOther"),
            reading: t("usageModuleLine", {
                calls: format.number(module.calls),
                credits: creditsTextOf(module.credits, format),
            }),
        })),
    }
    return {
        slot: workspaceId === undefined ? { isForbidden: true } : slotOfReads([query, catalog.read], () => data),
        placeholder: data,
        on: {
            retry: () => {
                void query.mutate()
                catalog.reload()
            },
            openCredits: () => {
                if (workspaceId !== undefined) router.push(workspaceHref(workspaceId, creditsPath()))
            },
            formatDay: (value) =>
                format.dateTime(dayjs.utc(String(value)).toDate(), { day: "numeric", month: "short", timeZone: "UTC" }),
            formatCredits: (value) => (typeof value === "number" ? format.number(creditsUsedShown(value)) : ""),
            minimumBarSize: (value) => (typeof value === "number" && value > 0 ? 4 : 0),
        },
    }
}
