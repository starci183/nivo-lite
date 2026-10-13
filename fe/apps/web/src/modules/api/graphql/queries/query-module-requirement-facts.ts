import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ModuleRequirementFactsQuery } from "../__generated__/graphql"

type QueryModuleRequirementFactsResponse = ModuleRequirementFactsQuery

const query1: TypedDocumentNode<QueryModuleRequirementFactsResponse, Record<string, never>> = gql`
    query ModuleRequirementFacts {
        moduleRequirementFacts {
            chatAgents
            members
            providers
            staff
        }
    }
`

enum QueryModuleRequirementFacts {
    Query1 = "query1",
}

const queryMap: Record<
    QueryModuleRequirementFacts,
    TypedDocumentNode<QueryModuleRequirementFactsResponse, Record<string, never>>
> = {
    [QueryModuleRequirementFacts.Query1]: query1,
}

type QueryModuleRequirementFactsParams = QueryParams<QueryModuleRequirementFacts>

/** The back end `moduleRequirementFacts` query. Rejects with the back end failure (message localized by the server). */
export const queryModuleRequirementFacts = async ({
    query = QueryModuleRequirementFacts.Query1,
    signal,
}: QueryModuleRequirementFactsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
