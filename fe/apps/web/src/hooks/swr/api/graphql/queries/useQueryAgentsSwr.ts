import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { queryAgents } from "@/modules/api/graphql/queries/query-agents"
import type { QueryAgentsRequest } from "@/modules/api/graphql/queries/query-agents"

/** The SWR key of {@link useQueryAgentsSwr}. */
export const QUERY_AGENTS_SWR_KEY = "QUERY_AGENTS_SWR"

/** The back end `agents` query. Pass `null` to wait for the arguments. */
export const useQueryAgentsSwr = (request: QueryAgentsRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_AGENTS_SWR_KEY,
        request,
        (input) => queryAgents({ request: input }),
        (data) => data.agents,
        config,
    )
