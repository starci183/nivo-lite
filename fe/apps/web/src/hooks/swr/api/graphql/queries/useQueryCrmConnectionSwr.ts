"use client"

import { argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import type { CrmConnectionQuery } from "@/modules/api"
import { queryCrmConnection } from "@/modules/api/graphql/queries/query-crm-connection"

/** The SWR key of the crmConnection query. */
export const QUERY_CRM_CONNECTION_SWR_KEY = "QUERY_CRM_CONNECTION_SWR"

/** A saved CRM connection (its address, how its key is sent, its pin). The key carries the connection; `undefined` pauses it. */
export const useQueryCrmConnectionSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration<CrmConnectionQuery["crmConnection"]>,
): ReadResponse<CrmConnectionQuery["crmConnection"]> =>
    useSWR(
        argumentKey(QUERY_CRM_CONNECTION_SWR_KEY, connectionId),
        async ([, id]) => {
            const result = await queryCrmConnection({ request: { connectionId: id } })
            if (!result.data) throw new Error("crmConnection answered no data")
            return result.data.crmConnection
        },
        { revalidateOnFocus: false, ...options },
    )
