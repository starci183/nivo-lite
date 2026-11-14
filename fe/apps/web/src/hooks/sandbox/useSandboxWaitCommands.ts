"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_SANDBOX_CALLS_SWR_KEY,
    QUERY_SANDBOX_WAITING_RUNS_SWR_KEY,
    useMutateExpireSandboxWaitSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { refreshSandbox } from "./sandbox.shared"

/** The command on the parked runs: end a wait now. */
export interface SandboxWaitCommands {
    /** Ends the wait a run is parked at through the real deadline road; answers whether it worked. The list is read again either way. */
    readonly expire: (runId: string) => Promise<boolean>
    /** The run whose wait is being ended; null when none is. */
    readonly expiringId: string | null
}

/** Ends waits, toasted in plain words. */
export const useSandboxWaitCommands = (): SandboxWaitCommands => {
    const t = useTranslations("sandbox")
    const run = useGraphQLWithToast()
    const expiring = useMutateExpireSandboxWaitSwr()
    const [expiringId, setExpiringId] = useState<string | null>(null)
    return {
        expire: async (runId) => {
            setExpiringId(runId)
            try {
                const answer = await run(() => expiring.trigger({ runId }), { successMessage: t("toastExpired") })
                await refreshSandbox(QUERY_SANDBOX_WAITING_RUNS_SWR_KEY, QUERY_SANDBOX_CALLS_SWR_KEY)
                return answer !== undefined
            } finally {
                setExpiringId(null)
            }
        },
        expiringId,
    }
}
