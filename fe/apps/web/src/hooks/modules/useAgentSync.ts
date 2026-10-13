import { useEffect, useState } from "react"
import type { AgentSyncStatus, DbOutcome } from "@/modules/db"

/** Poll the sync status this often while a sync is queued or running, and (slower) while idle so a background sync shows up on its own. */
const POLL_BUSY_MS = 2_500
const POLL_IDLE_MS = 20_000

/** What the sync card follows: the last status that was read, and a way to mark a sync as started. */
type AgentSync = {
    /** The last status read; the unknown state before the first read. */
    readonly status: AgentSyncStatus
    /** Whether a status was read at all. */
    readonly isKnown: boolean
    readonly markSyncing: () => void
}

const UNKNOWN: AgentSyncStatus = {
    state: "none",
    syncedVersion: null,
    activeVersion: null,
    checkedAt: null,
    error: null,
}

/** Follows the OpenClaw copy of an agent with the read the connected block passes in: fast while syncing, slow otherwise. */
export const useAgentSync = (
    installationId: string,
    read: (installationId: string) => Promise<DbOutcome<AgentSyncStatus>>,
): AgentSync => {
    const [status, setStatus] = useState<AgentSyncStatus>(UNKNOWN)
    const [isKnown, setKnown] = useState(false)
    const state = status.state
    useEffect(() => {
        const load = async () => {
            const outcome = await read(installationId)
            if (outcome.kind === "ok") {
                setStatus(outcome.value)
                setKnown(true)
            }
        }
        void load()
        const timer = setInterval(() => void load(), state === "syncing" ? POLL_BUSY_MS : POLL_IDLE_MS)
        return () => clearInterval(timer)
    }, [installationId, state, read])
    return { status, isKnown, markSyncing: () => setStatus((previous) => ({ ...previous, state: "syncing" })) }
}
