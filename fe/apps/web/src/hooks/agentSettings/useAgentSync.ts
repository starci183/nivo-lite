"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useMutateRequestAgentSyncSwr, useQueryAgentSyncStatusSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { SYNC_POLL_BUSY_MS, SYNC_POLL_IDLE_MS, UNKNOWN_SYNC, toAgentSync } from "./agentSettings.shared"

/** Follows the OpenClaw copy of an agent: fast while a sync runs, slow otherwise; `resync` queues a sync now. */
export const useAgentSync = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const [answeredAt, setAnsweredAt] = useState<number | null>(null)
    const read = useQueryAgentSyncStatusSwr(
        { installationId },
        {
            refreshInterval: (latest: { readonly state: string } | undefined) =>
                latest?.state === "syncing" ? SYNC_POLL_BUSY_MS : SYNC_POLL_IDLE_MS,
            onSuccess: () => setAnsweredAt(Date.now()),
        },
    )
    const { trigger, isMutating } = useMutateRequestAgentSyncSwr()
    const status = useMemo(() => (read.data === undefined ? UNKNOWN_SYNC : toAgentSync(read.data)), [read.data])
    const { mutate } = read
    const checkedAgoSeconds =
        status.checkedAt === null || answeredAt === null
            ? null
            : Math.max(0, Math.round((answeredAt - Date.parse(status.checkedAt)) / 1000))
    const resync = useCallback(async (): Promise<void> => {
        const queued = await runGraphQL(() => trigger({ installationId, force: true }), {
            successMessage: t("saved"),
        })
        if (queued !== undefined) await mutate()
    }, [installationId, runGraphQL, trigger, mutate, t])
    return { status, checkedAgoSeconds, isKnown: read.data !== undefined, resync, isQueuing: isMutating }
}
