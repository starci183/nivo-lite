"use client"

import { useTranslations } from "next-intl"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import type { WorkbenchNeedView } from "@/modules/types"
import { unmetNeedsOf } from "@/modules/utils"
import type { WorkbenchNeedFacts } from "@/modules/utils"

/** The needs of a desk that the connections and the read model leave unmet, worded for `NeedsBlock`, each with the one place to connect. */
export const useWorkbenchNeeds = (module: string, facts: WorkbenchNeedFacts): ReadonlyArray<WorkbenchNeedView> => {
    const t = useTranslations("workbench")
    const words = (id: string): { readonly title: string; readonly body: string } => {
        if (id === "meta") return { title: t("needMetaTitle"), body: t("needMetaBody") }
        if (id === "ads") return { title: t("needAdsTitle"), body: t("needAdsBody") }
        if (id === "money") return { title: t("needMoneyTitle"), body: t("needMoneyBody") }
        return { title: t("needInvoicesTitle"), body: t("needInvoicesBody") }
    }
    return unmetNeedsOf(module, facts).map((need) => ({
        id: need.id,
        ...words(need.id),
        badge: t("notConnected"),
        actionLabel: t("connect"),
        href: AUTOMATION_ROUTES.connections,
    }))
}
