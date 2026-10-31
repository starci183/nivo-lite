"use client"

import { useCallback } from "react"
import { useMutateDisconnectConnectionSwr, useMutateDisconnectDriveSwr } from "@/hooks/swr"
import type { Provider } from "@/modules/types"

/**
 * Disconnects one connection of a provider. Google Drive disconnects through its grant, which also forgets the stored tokens (owner
 * only); every other provider goes through the generic disconnect of its connection.
 */
export const useDisconnectConnection = (provider: Provider) => {
    const connection = useMutateDisconnectConnectionSwr()
    const drive = useMutateDisconnectDriveSwr()
    const { trigger: triggerConnection } = connection
    const { trigger: triggerDrive } = drive
    const trigger = useCallback(
        (connectionId: string): Promise<boolean> =>
            provider === "google_drive" ? triggerDrive() : triggerConnection({ connectionId }),
        [provider, triggerConnection, triggerDrive],
    )
    return { trigger, isMutating: connection.isMutating || drive.isMutating }
}
