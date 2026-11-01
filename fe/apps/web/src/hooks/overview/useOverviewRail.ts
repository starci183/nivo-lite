"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
import { toActivityModels } from "@/hooks/overviewRows"
import { isModuleKey } from "@/modules/catalog"
import { agentLifecycleOf } from "@/modules/installations"
import { useOverviewData } from "./useOverviewData"

/**
 * The agents and the recent activity of the rail; undefined until the dashboard is read. Each agent stands in the one state the back end
 * names for its installation (the lifecycle), never in the status of the agent row.
 */
export const useOverviewRail = () => {
    const t = useTranslations("responsibilities")
    const { dashboard } = useOverviewData()
    const { installations } = useInstallations()
    return useMemo(() => {
        if (dashboard === undefined || installations === undefined) return undefined
        return {
            agents: dashboard.agents.flatMap((agent) =>
                isModuleKey(agent.module)
                    ? [
                          {
                              id: agent.id,
                              module: agent.module,
                              name: agent.name,
                              lifecycle: agentLifecycleOf(installations.find((one) => one.agentId === agent.id)),
                          },
                      ]
                    : [],
            ),
            activity: toActivityModels(dashboard.events, new Date(), t),
        }
    }, [dashboard, installations, t])
}
