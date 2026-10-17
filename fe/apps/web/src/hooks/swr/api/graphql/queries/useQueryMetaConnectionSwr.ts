"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryMetaConnection } from "@/modules/api/graphql/queries/query-meta-connection"

/** The SWR key of the metaConnection query. */
export const QUERY_META_CONNECTION_SWR_KEY = "QUERY_META_CONNECTION_SWR"

/** The Meta wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryMetaConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_META_CONNECTION_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(await queryMetaConnection({ request: { connectionId: input } }), QUERY_META_CONNECTION_SWR_KEY)
                .metaConnection,
        options,
    )
