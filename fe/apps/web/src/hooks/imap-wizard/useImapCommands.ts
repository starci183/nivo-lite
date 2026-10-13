"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveImapConnectionSwr } from "@/hooks/swr"
import type { MutateSaveImapConnectionRequest } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"
import { queryTestImapConnection } from "@/modules/api/graphql/queries/query-test-imap-connection"
import type { QueryTestImapConnectionRequest } from "@/modules/api/graphql/queries/query-test-imap-connection"

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
    const refresh = useConnectionsRefresh()
    const { trigger: triggerSave } = useMutateSaveImapConnectionSwr()
    return useMemo(
        () => ({
            test: (request) =>
                settle(async () => {
                    const result = await queryTestImapConnection({ request })
                    if (!result.data) throw new Error("testImapConnection answered no data")
                    return result.data.testImapConnection.folders
                }),
            save: async (request) => {
                const settled = await settle(() => triggerSave(request))
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerSave],
    )
}
