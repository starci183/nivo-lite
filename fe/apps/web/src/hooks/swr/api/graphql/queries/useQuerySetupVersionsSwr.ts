"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { querySetupVersions } from "@/modules/api/graphql/queries/query-setup-versions"
import type { QuerySetupVersionsRequest } from "@/modules/api/graphql/queries/query-setup-versions"

/** The SWR key of {@link useQuerySetupVersionsSwr}. */
export const QUERY_SETUP_VERSIONS_SWR_KEY = "QUERY_SETUP_VERSIONS_SWR"

/** The back end `setupVersions` query. Pass `null` to wait for the arguments. */
export const useQuerySetupVersionsSwr = (request: QuerySetupVersionsRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_SETUP_VERSIONS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QuerySetupVersionsRequest>) =>
            answeredData(await querySetupVersions({ request: input }), QUERY_SETUP_VERSIONS_SWR_KEY).setupVersions,
        config,
    )
