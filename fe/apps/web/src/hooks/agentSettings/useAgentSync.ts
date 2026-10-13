import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutateRequestAgentSyncSwr, useQueryAgentSyncStatusSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { SYNC_CLOCK_MS, SYNC_POLL_BUSY_MS, SYNC_POLL_IDLE_MS, UNKNOWN_SYNC, toAgentSync } from "./agentSettings.shared"

/** Follows the OpenClaw copy of an agent: fast while a sync runs, slow otherwise; `resync` queues a sync now. */
export const useAgentSync = (installationId: string) => {
    const t = useTranslations("modulesCore")
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryAgentSyncStatusSwr(
        { installationId },
        { refreshInterval: (latest) => (latest?.state === "syncing" ? SYNC_POLL_BUSY_MS : SYNC_POLL_IDLE_MS) },
    )
    const { trigger, isMutating } = useMutateRequestAgentSyncSwr()
    const status = useMemo(() => (read.data === undefined ? UNKNOWN_SYNC : toAgentSync(read.data)), [read.data])
    const { mutate } = read
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), SYNC_CLOCK_MS)
        return () => clearInterval(timer)
    }, [])
    const checkedAgoSeconds =
        status.checkedAt === null ? null : Math.max(0, Math.round((now - Date.parse(status.checkedAt)) / 1000))
    const resync = useCallback(async (): Promise<void> => {
        const queued = await runGraphQL(() => trigger({ installationId, force: true }), {
            successMessage: t("saved"),
        })
        if (queued !== undefined) await mutate()
    }, [installationId, runGraphQL, trigger, mutate, t])
    return { status, checkedAgoSeconds, isKnown: read.data !== undefined, resync, isQueuing: isMutating }
}
