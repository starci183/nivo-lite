"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useAgentInstallation, useAgentRights } from "@/hooks/agentSettings"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentWorkSwr, useQueryWorkspaceAgentWorkSwr } from "@/hooks/swr"
import { workItemHref } from "@/modules/routes"
import type { AgentWorkView } from "@/modules/types"
import { WORK_POLL_BUSY_MS, WORK_POLL_IDLE_MS, toWorkView } from "@/modules/agentWork"

/** True when a turn of the answer is still running. */
const isRunning = (latest: { readonly turns: ReadonlyArray<{ readonly status: string }> } | undefined): boolean =>
    latest?.turns.some((turn) => turn.status === "running") === true

/**
 * The Work tab of one agent instance, in words: asked again every 5 seconds while a turn runs and every 30 seconds otherwise. A paused
 * installation and a workspace with work switched off are read beside it, so the status band says which one stops the agent.
 */
export const useAgentWork = (module: string, installationId: string) => {
    const t = useTranslations("agentWork")
    const tAgent = useTranslations("modulesCore")
    const format = useFormatter()
    const { canEdit } = useAgentRights()
    const { installation } = useAgentInstallation(installationId, module)
    const [now, setNow] = useState(() => Date.now())
    const read = useQueryAgentWorkSwr(
        { installationId },
        {
            refreshInterval: (latest: Parameters<typeof isRunning>[0]) =>
                isRunning(latest) ? WORK_POLL_BUSY_MS : WORK_POLL_IDLE_MS,
            onSuccess: () => setNow(Date.now()),
        },
    )
    const workspace = useQueryWorkspaceAgentWorkSwr({ refreshInterval: WORK_POLL_IDLE_MS })
    const lifecycle = installation?.lifecycle ?? null
    const lifecycleLabel = lifecycle === null ? "" : tAgent(`lifecycle_${lifecycle}`)
    const isWorkspaceOff = workspace.data?.workEnabled === false
    const { data, mutate } = read
    const view = useMemo(
        () =>
            data === undefined
                ? undefined
                : toWorkView(data, {
                      t,
                      format,
                      now,
                      lifecycle,
                      lifecycleLabel,
                      isWorkspaceOff,
                      canEdit,
                      hrefOfWorkItem: (workItemId) => workItemHref(module, workItemId),
                  }),
        [data, t, format, now, lifecycle, lifecycleLabel, isWorkspaceOff, canEdit, module],
    )
    const slot = slotOfSwr<AgentWorkView>({ data: view, error: read.error, isLoading: read.isLoading })
    return { slot, reload: () => void mutate() }
}
