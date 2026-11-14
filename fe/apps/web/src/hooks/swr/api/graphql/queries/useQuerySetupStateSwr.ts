"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { querySetupState, type QuerySetupStateRequest } from "@/modules/api/graphql/queries/query-setup-state"
import type { SetupStateQuery } from "@/modules/api"

/** The SWR key of {@link useQuerySetupStateSwr}. */
export const QUERY_SETUP_STATE_SWR_KEY = "QUERY_SETUP_STATE_SWR"

/** The back end `setupState` query. Pass `null` to wait for the arguments. */
export const useQuerySetupStateSwr = (
    request: QuerySetupStateRequest | null,
    config?: SWRConfiguration,
): ReadResponse<SetupStateQuery["setupState"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_SETUP_STATE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QuerySetupStateRequest>) =>
            answeredData(await querySetupState({ request: input }), QUERY_SETUP_STATE_SWR_KEY).setupState,
        config,
    )
