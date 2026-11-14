"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryProviderRightHolders } from "@/modules/api/graphql/queries/query-provider-right-holders"
import type { ProviderRightHoldersQuery } from "@/modules/api"

/** The SWR key of who holds each right of one connected account. */
export const QUERY_PROVIDER_RIGHT_HOLDERS_SWR_KEY = "QUERY_PROVIDER_RIGHT_HOLDERS_SWR"

/** Who holds each right of one connected account (the back end `providerRightHolders` query). Pass `null` while no account is open. */
export const useQueryProviderRightHoldersSwr = (
    connectionId: string | null,
): ReadResponse<ProviderRightHoldersQuery["providerRightHolders"]> =>
    useSWR(
        useWorkspaceKey(QUERY_PROVIDER_RIGHT_HOLDERS_SWR_KEY, [connectionId], connectionId !== null && connectionId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(
                await queryProviderRightHolders({ request: { connectionId: connectionId ?? "" }, signal }),
                "providerRightHolders",
            ).providerRightHolders,
        { errorRetryCount: 1 },
    )
