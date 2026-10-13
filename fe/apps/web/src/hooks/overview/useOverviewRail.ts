"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { toActivityModels } from "@/hooks/overviewRows"
import { isModuleKey } from "@/modules/catalog"
import { useOverviewData } from "./useOverviewData"

/** The agents and the recent activity of the rail; undefined until the dashboard is read. */
export const useOverviewRail = () => {
    const t = useTranslations("responsibilities")
    const { dashboard } = useOverviewData()
    return useMemo(() => {
        if (dashboard === undefined) return undefined
        return {
            agents: dashboard.agents.flatMap((agent) =>
                isModuleKey(agent.module)
                    ? [{ id: agent.id, module: agent.module, name: agent.name, isActive: agent.status !== "paused" }]
                    : [],
            ),
            activity: toActivityModels(dashboard.events, new Date(), t),
        }
    }, [dashboard, t])
}
