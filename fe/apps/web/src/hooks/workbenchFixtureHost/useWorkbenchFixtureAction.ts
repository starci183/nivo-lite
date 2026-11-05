"use client"

import { useCallback, useContext } from "react"
import type { ActionInput, ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { HostAction } from "@nivo-lite/agent-sdk/client"
import { FixtureTablesContext, SUCCEEDED } from "@/modules/workbench-host"

/** One action of the prototype data port: answers the outcome the fixture of the operation gives, success when it has none. */
export const useWorkbenchFixtureAction = (operation: string): HostAction => {
    const tables = useContext(FixtureTablesContext)
    const source = tables.actions[operation]
    const run = useCallback(
        (input: ActionInput): Promise<ActionOutcome> => Promise.resolve(source?.(input) ?? SUCCEEDED),
        [source],
    )
    return { run, isRunning: false }
}
