"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { groupByOwner, stampOf } from "@/hooks/overviewRows"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { trimGroups } from "./overview.shared"
import { useOverviewData } from "./useOverviewData"
import { useOverviewRows } from "./useOverviewRows"
import type { OwnerGroupModel } from "@/hooks/overviewRows"

type UseOverviewOwnersResult =
    | {
          title: string
          verifiedLabel: string
          groups: OwnerGroupModel[]
          emptyMessage: string
          emptyDescription: string
          emptyActionLabel: string
          emptyHref: "/leads?new=1" | "/modules"
      }
    | undefined

/** The open work by owner with the words of its empty state; undefined until the dashboard is read. */
export const useOverviewOwners = (): UseOverviewOwnersResult => {
    const t = useTranslations("overview")
    const format = useFormatter()
    const { dashboard } = useOverviewData()
    const data = useOverviewRows()
    return useMemo(() => {
        if (dashboard === undefined || data === undefined) return undefined
        const hasAgents = dashboard.agents.length > 0
        return {
            title: t("byOwner"),
            verifiedLabel: t("verified", { time: stampOf(format, data.now) }),
            groups: trimGroups(groupByOwner(data.active)),
            emptyMessage: t("emptyMessage"),
            emptyDescription: hasAgents ? t("emptyWithAgents") : t("emptyNoAgents"),
            emptyActionLabel: hasAgents ? t("emptyActionLead") : t("emptyActionModules"),
            emptyHref: hasAgents ? CONSOLE_ROUTES.newLead : CONSOLE_ROUTES.modules,
        }
    }, [dashboard, data, format, t])
}
