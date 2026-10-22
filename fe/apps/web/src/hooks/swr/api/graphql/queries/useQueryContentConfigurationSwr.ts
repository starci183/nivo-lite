"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryContentConfiguration } from "@/modules/api/graphql/queries/query-content-configuration"

/** The SWR key of the contentConfiguration query. */
export const QUERY_CONTENT_CONFIGURATION_SWR_KEY = "QUERY_CONTENT_CONFIGURATION_SWR"

/** The content configuration of the workspace. */
export const useQueryContentConfigurationSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_CONFIGURATION_SWR_KEY, [] as const),
        async () =>
            answeredData(await queryContentConfiguration(), QUERY_CONTENT_CONFIGURATION_SWR_KEY).contentConfiguration,
    )
