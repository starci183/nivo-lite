"use client"

import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { querySetupVersions } from "@/modules/api/graphql/queries/query-setup-versions"
import type { QuerySetupVersionsRequest } from "@/modules/api/graphql/queries/query-setup-versions"

/** The SWR key of {@link useQuerySetupVersionsSwr}. */
export const QUERY_SETUP_VERSIONS_SWR_KEY = "QUERY_SETUP_VERSIONS_SWR"

/** The back end `setupVersions` query. Pass `null` to wait for the arguments. */
export const useQuerySetupVersionsSwr = (request: QuerySetupVersionsRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_SETUP_VERSIONS_SWR_KEY,
        request,
        (input) => querySetupVersions({ request: input }),
        (data) => data.setupVersions,
        config,
    )
