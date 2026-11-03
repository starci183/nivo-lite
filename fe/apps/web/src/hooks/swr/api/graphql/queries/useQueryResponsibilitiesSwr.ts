"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryResponsibilities } from "@/modules/api/graphql/queries/query-responsibilities"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of {@link useQueryResponsibilitiesSwr}. */
export const QUERY_RESPONSIBILITIES_SWR_KEY = "QUERY_RESPONSIBILITIES_SWR"

/** The back end `responsibilities` query. */
export const useQueryResponsibilitiesSwr = (
    config?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryResponsibilities>["responsibilities"] | undefined> =>
    useSWR(
        useWorkspaceKey(QUERY_RESPONSIBILITIES_SWR_KEY, []),
        async () => (await queryResponsibilities()).data?.responsibilities,
        config,
    )
