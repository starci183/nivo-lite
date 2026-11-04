"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryGoogleState } from "@/modules/api/graphql/queries/query-google-state"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { GoogleConnectionStateQuery } from "@/modules/api"

/** The SWR key of the Google state of the workspace. */
export const QUERY_GOOGLE_STATE_SWR_KEY = "QUERY_GOOGLE_STATE_SWR"

/** Whether Google is set up, whether its consent is awaited, and where the ledger stands (the back end `googleConnectionState` query). */
export const useQueryGoogleStateSwr = (
    enabled = true,
): ReadResponse<GoogleConnectionStateQuery["googleConnectionState"]> =>
    useSWR(
        useWorkspaceKey(QUERY_GOOGLE_STATE_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryGoogleState({ signal })
            if (!result.data) throw new Error("googleConnectionState answered no data")
            return result.data.googleConnectionState
        },
    )
