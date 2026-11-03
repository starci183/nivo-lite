"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryContentConfiguration } from "@/modules/api/graphql/queries/query-content-configuration"
import type { ContentConfigurationQuery } from "@/modules/api"

/** The SWR key of the contentConfiguration query. */
export const QUERY_CONTENT_CONFIGURATION_SWR_KEY = "QUERY_CONTENT_CONFIGURATION_SWR"

/** The content configuration of the workspace. */
export const useQueryContentConfigurationSwr = (
    isActive = true,
): SWRResponse<ContentConfigurationQuery["contentConfiguration"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_CONFIGURATION_SWR_KEY, isActive ? ([] as const) : null),
        async () =>
            answeredData(await queryContentConfiguration(), QUERY_CONTENT_CONFIGURATION_SWR_KEY).contentConfiguration,
    )
