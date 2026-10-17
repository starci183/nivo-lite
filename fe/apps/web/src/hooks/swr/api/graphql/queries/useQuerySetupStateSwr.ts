"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { querySetupState } from "@/modules/api/graphql/queries/query-setup-state"
import type { QuerySetupStateRequest } from "@/modules/api/graphql/queries/query-setup-state"

/** The SWR key of {@link useQuerySetupStateSwr}. */
export const QUERY_SETUP_STATE_SWR_KEY = "QUERY_SETUP_STATE_SWR"

/** The back end `setupState` query. Pass `null` to wait for the arguments. */
export const useQuerySetupStateSwr = (request: QuerySetupStateRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_SETUP_STATE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QuerySetupStateRequest>) =>
            answeredData(await querySetupState({ request: input }), QUERY_SETUP_STATE_SWR_KEY).setupState,
        config,
    )
