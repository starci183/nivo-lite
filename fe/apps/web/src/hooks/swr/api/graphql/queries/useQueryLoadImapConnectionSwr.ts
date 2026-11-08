"use client"

import { argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import { queryLoadImapConnection } from "@/modules/api/graphql/queries/query-load-imap-connection"
import type { LoadImapConnectionQuery } from "@/modules/api"

/** The SWR key of the loadImapConnection query. */
export const QUERY_LOAD_IMAP_CONNECTION_SWR_KEY = "QUERY_LOAD_IMAP_CONNECTION_SWR"

/** The saved mailbox for editing. The key carries the connection; `undefined` pauses it. */
export const useQueryLoadImapConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<LoadImapConnectionQuery["loadImapConnection"]> =>
    useSWR(
        argumentKey(QUERY_LOAD_IMAP_CONNECTION_SWR_KEY, connectionId),
        async ([, id]) => {
            const result = await queryLoadImapConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("loadImapConnection answered no data")
            return result.data.loadImapConnection
        },
        { revalidateOnFocus: false, ...options },
    )
