"use client"

import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { queryDecisionHistory } from "@/modules/api/graphql/queries/query-decision-history"
import type { QueryDecisionHistoryRequest } from "@/modules/api/graphql/queries/query-decision-history"

/** The SWR key of {@link useQueryDecisionHistorySwr}. */
export const QUERY_DECISION_HISTORY_SWR_KEY = "QUERY_DECISION_HISTORY_SWR"

/** The back end `decisionHistory` query. Pass `null` to wait for the arguments. */
export const useQueryDecisionHistorySwr = (request: QueryDecisionHistoryRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_DECISION_HISTORY_SWR_KEY,
        request,
        (input) => queryDecisionHistory({ request: input }),
        (data) => data.decisionHistory,
        config,
    )
