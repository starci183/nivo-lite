"use client"

import { useTranslations } from "next-intl"
import { useConnectionsData } from "@/hooks/connections"
import { PHASE_COUNT, lifecycleChipOf } from "@/modules/connection-lifecycle"
import type { ConnectionLifecycle, ConnectionLifecycleChip } from "@/modules/types"
import { useDrivePage } from "./useDrivePage"
import { useDriveProgress } from "./useDriveProgress"

/** The view `useDriveLife` returns. */
export interface DriveLifeView {
    /** Where the grant stands in the shared life; null while the grant or the sources are read. */
    life: ConnectionLifecycle | null
    /** The status badge of that life in the shared vocabulary; null while it is read. */
    chip: ConnectionLifecycleChip | null
    /** How many phases the setup has (the shared four). */
    phaseCount: number
    /** The id of the workspace's Drive connection record, when it has one (the agents' grants hang on it). */
    connectionId: string | undefined
    /** How many agents work through Drive; undefined while the connections are read. */
    agentCount: number | undefined
}

/**
 * Where the workspace's Google Drive grant stands in the one life every connection shares: no grant is "not connected" (the grant
 * phase is next), a revoked one needs the owner, a grant with no document read yet waits for its first sync, and a grant that has
 * read documents runs. Drive sends no webhook, so the first synced document is its first event.
 */
export const useDriveLife = (enabled = true): DriveLifeView => {
    const t = useTranslations("connections")
    const { slot } = useDrivePage(enabled)
    const { count, isLoaded } = useDriveProgress(enabled)
    const data = useConnectionsData()
    const record = data.items.find((item) => item.provider === "google_drive")
    const standing = ("items" in slot ? slot.items : undefined)?.standing
    const life = ((): ConnectionLifecycle | null => {
        if (standing === undefined) return null
        if (standing === "none") return { id: "unconnected" }
        if (standing === "lost") return { id: "attention" }
        if (!isLoaded) return null
        return count > 0 ? { id: "running" } : { id: "waiting", phase: 3 }
    })()
    return {
        life,
        chip: life === null ? null : lifecycleChipOf(life, (key, values) => t(key, values)),
        phaseCount: PHASE_COUNT,
        connectionId: record?.id,
        agentCount: "items" in data.slot ? (record?.agentIds.length ?? 0) : undefined,
    }
}
