"use client"

import type { AccountingWorkbenchData } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { accountingUpcomingRowsOf } from "@/hooks/accountingUpcoming"

/**
 * The Upcoming list of the Overview tab: the tax deadlines of the Brain tax profile and the open supplier invoices, soonest first.
 * With no tax profile the list is unknown, so it says what it needs; with no invoice connector it lists tax only and says so.
 */
export const useAccountingUpcoming = (data: AccountingWorkbenchData) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const router = navigation.useRouter()
    const rows = data.upcoming === null ? [] : accountingUpcomingRowsOf(t, format, data.upcoming, data.reminderDays)
    return {
        props: {
            title: t("upcomingTitle"),
            rows,
            isUnknown: data.upcoming === null,
            emptyMessage: data.upcoming === null ? t("upcomingNoProfile") : t("upcomingEmpty"),
            emptyBody: data.upcoming === null ? t("upcomingNoProfileBody") : t("upcomingEmptyBody"),
            openBrainLabel: t("upcomingOpenBrain"),
            note: data.upcoming !== null && data.payablesSource === null ? t("upcomingTaxOnly") : null,
        },
        on: {
            openBrain: () => router.push(brainTabHref("facts")),
        },
    }
}
