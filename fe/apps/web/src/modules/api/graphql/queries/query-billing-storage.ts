import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryBillingStorageResponse = Pick<Query, "billingStorage">

const query1: TypedDocumentNode<QueryBillingStorageResponse> = gql`
    query BillingStorage {
        billingStorage {
            usedBytes
            quotaBytes
        }
    }
`

enum QueryBillingStorage {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingStorage, typeof query1> = { [QueryBillingStorage.Query1]: query1 }

/** Calls the backend billingStorage query: the bytes the selected workspace keeps against its plan. */
export const queryBillingStorage = async ({
    query = QueryBillingStorage.Query1,
    signal,
}: QueryParams<QueryBillingStorage> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
