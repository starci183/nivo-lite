"use client"

import { useMemo } from "react"
import { governanceFrom, waitingWorkFrom } from "@/hooks/overviewGovernance"
import { useOverviewData } from "./useOverviewData"

import type { Governance, WaitingWork } from "../overviewFigures"

type UseOverviewGovernanceResult =
    | {
          governance: Governance
          waiting: WaitingWork[]
      }
    | undefined

/** The governance figures and the decisions waiting for the owner; undefined until the dashboard is read. */
export const useOverviewGovernance = (): UseOverviewGovernanceResult => {
    const { dashboard } = useOverviewData()
    return useMemo(
        () =>
            dashboard === undefined
                ? undefined
                : {
                      governance: governanceFrom(dashboard.governance, dashboard.since7),
                      waiting: waitingWorkFrom(dashboard.exceptions),
                  },
        [dashboard],
    )
}
