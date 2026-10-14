"use client"

import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { querySetupState } from "@/modules/api/graphql/queries/query-setup-state"
import type { QuerySetupStateRequest } from "@/modules/api/graphql/queries/query-setup-state"

/** The SWR key of {@link useQuerySetupStateSwr}. */
export const QUERY_SETUP_STATE_SWR_KEY = "QUERY_SETUP_STATE_SWR"

/** The back end `setupState` query. Pass `null` to wait for the arguments. */
export const useQuerySetupStateSwr = (request: QuerySetupStateRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_SETUP_STATE_SWR_KEY,
        request,
        (input) => querySetupState({ request: input }),
        (data) => data.setupState,
        config,
    )
