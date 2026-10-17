"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryDecisionHistory } from "@/modules/api/graphql/queries/query-decision-history"
import type { QueryDecisionHistoryRequest } from "@/modules/api/graphql/queries/query-decision-history"

/** The SWR key of {@link useQueryDecisionHistorySwr}. */
export const QUERY_DECISION_HISTORY_SWR_KEY = "QUERY_DECISION_HISTORY_SWR"

/** The back end `decisionHistory` query. Pass `null` to wait for the arguments. */
export const useQueryDecisionHistorySwr = (request: QueryDecisionHistoryRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_DECISION_HISTORY_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryDecisionHistoryRequest>) =>
            answeredData(await queryDecisionHistory({ request: input }), QUERY_DECISION_HISTORY_SWR_KEY)
                .decisionHistory,
        config,
    )
