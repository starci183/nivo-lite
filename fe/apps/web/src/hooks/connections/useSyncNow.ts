"use client"

import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useMutateRequestDataSyncSwr, useQueryDataSyncRunSwr } from "@/hooks/swr"
import type { RowNote } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/** The sync-now command of a data connection: it queues the sync, follows its run until it ends and tells how it went. */
export interface SyncNow {
    /** Queues a sync of the connection now (fire and forget: progress shows in `isRunning` and `outcome`). */
    readonly start: (connectionId: string) => Promise<void>
    /** A sync is queued or running. */
    readonly isRunning: boolean
    /** How the last sync ended, or null while none ended yet. */
    readonly outcome: RowNote | null
}

/** "Sync now" for a data connection (owner): `requestDataSync`, then the run is polled until it is no longer running; the list is reloaded at the end. */
export const useSyncNow = (): SyncNow => {
    const t = useTranslations("connections")
    const tToast = useTranslations("toast")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger } = useMutateRequestDataSyncSwr()
    const [runId, setRunId] = useState<string | undefined>(undefined)
    const [refused, setRefused] = useState<RowNote | null>(null)
    const { data: run } = useQueryDataSyncRunSwr(runId, {
        onSuccess: (latest) => {
            if (latest.state !== "running") void refresh()
        },
    })

    const start = useCallback(
        async (connectionId: string) => {
            setRefused(null)
            setRunId(undefined)
            const settled = await settle(() => trigger({ connectionId }))
            if (settled.kind === "failed") return setRefused({ tone: "negative", text: settled.message })
            setRunId(settled.value.id)
        },
        [settle, trigger],
    )

    const ended = run !== undefined && run.state !== "running"
    let outcome: RowNote | null = refused
    if (ended && run.state === "ok") outcome = { tone: "affirmative", text: t("syncDone", { rows: run.rows }) }
    else if (ended) outcome = { tone: "negative", text: run.error ?? tToast("defaultError") }
    return { start, isRunning: runId !== undefined && !ended, outcome }
}
