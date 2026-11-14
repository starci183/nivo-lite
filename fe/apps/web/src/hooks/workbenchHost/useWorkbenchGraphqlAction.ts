"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { type ActionInput, type ActionOutcome, actionPayloadOf, outcomeOf } from "@nivo-lite/agent-sdk/block"
import type { HostAction, HostActionOptions } from "@nivo-lite/agent-sdk/client"
import { useMutateWorkbenchActionSwr } from "@/hooks/swr"
import { isForbiddenFailure } from "@/modules/failure"
import { viewerCache } from "@/modules/viewer-cache"
import { actionResultOf, isRefreshedKey } from "@/modules/workbench-host"
import { useRouteInstallationId } from "./useRouteInstallationId"

/**
 * One action of the live data port: the generic action operation, its answer turned into the block outcome. On an ok outcome every
 * cached read whose operation the action refreshes is read again. A transport failure or an unreadable answer is a failed outcome
 * in the viewer language, never a throw.
 */
export const useWorkbenchGraphqlAction = (operation: string, options?: HostActionOptions): HostAction => {
    const t = useTranslations("workbenchHost")
    const { trigger, isMutating } = useMutateWorkbenchActionSwr()
    const installationId = useRouteInstallationId()
    const refreshes = options?.refreshes
    const run = useCallback(
        async (input: ActionInput): Promise<ActionOutcome> => {
            const refused = (
                reason: "failed" | "forbidden",
                key: "failed" | "forbidden" | "unreadable",
            ): ActionOutcome => {
                const words = t(key)
                return { ok: false, reason, message: { vi: words, en: words } }
            }
            try {
                const result = actionResultOf(await trigger({ name: operation, input: actionPayloadOf(input), installationId }))
                if (result === null) return refused("failed", "unreadable")
                if (result.ok && refreshes !== undefined && refreshes.length > 0)
                    await viewerCache.mutate((key) => isRefreshedKey(key, refreshes))
                return outcomeOf(result)
            } catch (error) {
                return isForbiddenFailure(error) ? refused("forbidden", "forbidden") : refused("failed", "failed")
            }
        },
        [installationId, operation, refreshes, t, trigger],
    )
    return { run, isRunning: isMutating }
}
