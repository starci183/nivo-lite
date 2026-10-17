"use client"

import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveImapConnectionSwr, useQueryTestImapConnectionSwr } from "@/hooks/swr"
import type { MutateSaveImapConnectionRequest, QueryTestImapConnectionRequest } from "@/hooks/swr"
import { useMemo } from "react"

/** The GraphQL commands of the mailbox wizard (the active workspace travels in the request header). */
export interface ImapCommands {
    /** Logs in read only and answers the folder paths; nothing is saved. */
    readonly test: (request: QueryTestImapConnectionRequest) => Promise<Settled<ReadonlyArray<string>>>
    /** Creates or updates the mailbox and answers its connection id. */
    readonly save: (request: MutateSaveImapConnectionRequest) => Promise<Settled<string>>
}

/** The mailbox wizard's operations bound to the toast helper. */
export const useImapCommands = (): ImapCommands => {
    const settle = useSettledGraphQL()
    const { trigger: testConnection } = useQueryTestImapConnectionSwr()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerSave } = useMutateSaveImapConnectionSwr()
    return useMemo(
        () => ({
            test: (request) =>
                settle(async () => {
                    return (await testConnection(request)).folders
                }),
            save: async (request) => {
                const settled = await settle(() => triggerSave(request))
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerSave, testConnection],
    )
}
