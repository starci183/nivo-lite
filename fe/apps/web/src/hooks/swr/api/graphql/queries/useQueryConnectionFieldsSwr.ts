"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryConnectionFields } from "@/modules/api/graphql/queries/query-connection-fields"
import type { ConnectionFieldsQuery } from "@/modules/api"

/** The SWR key of the form of one connected account. */
export const QUERY_CONNECTION_FIELDS_SWR_KEY = "QUERY_CONNECTION_FIELDS_SWR"

/** The form of one connected account (the back end `connectionFields` query). Pass `null` while no account is open. */
export const useQueryConnectionFieldsSwr = (
    connectionId: string | null,
): ReadResponse<ConnectionFieldsQuery["connectionFields"]> =>
    useSWR(
        useWorkspaceKey(QUERY_CONNECTION_FIELDS_SWR_KEY, [connectionId], connectionId !== null && connectionId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryConnectionFields({ request: { connectionId: connectionId ?? "" }, signal }), "connectionFields")
                .connectionFields,
        { errorRetryCount: 1, revalidateOnFocus: false },
    )
