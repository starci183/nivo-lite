"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryProviderTriggerStates } from "@/modules/api/graphql/queries/query-provider-trigger-states"
import type { ProviderTriggerStatesQuery } from "@/modules/api"

/** The SWR key of the trigger switches of one connected account. */
export const QUERY_PROVIDER_TRIGGER_STATES_SWR_KEY = "QUERY_PROVIDER_TRIGGER_STATES_SWR"

/**
 * The trigger switches of one connected account (the back end `providerTriggerStates` query): one row per trigger its provider
 * declares. Pass `null` while no account is open.
 */
export const useQueryProviderTriggerStatesSwr = (
    connectionId: string | null,
): ReadResponse<ProviderTriggerStatesQuery["providerTriggerStates"]> =>
    useSWR(
        useWorkspaceKey(QUERY_PROVIDER_TRIGGER_STATES_SWR_KEY, [connectionId], connectionId !== null && connectionId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(
                await queryProviderTriggerStates({ request: { connectionId: connectionId ?? "" }, signal }),
                "providerTriggerStates",
            ).providerTriggerStates,
        { errorRetryCount: 1, revalidateOnFocus: false },
    )
