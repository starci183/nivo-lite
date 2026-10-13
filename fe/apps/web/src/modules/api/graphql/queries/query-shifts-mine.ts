import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ShiftsMineQuery } from "../__generated__/graphql"

/** The response of the `shiftsMine` query. */
type QueryShiftsMineResponse = ShiftsMineQuery

const query1: TypedDocumentNode<QueryShiftsMineResponse> = gql`
    query ShiftsMine {
        shiftsMine {
            availability {
                available
                createdAt
                date
                end
                id
                note
                staffId
                start
                status
                weekday
            }
            colleagues {
                id
                name
                positionIds
            }
            leaves {
                createdAt
                from
                id
                item {
                    decidedPath
                    id
                    resultSummary
                    status
                    summary
                }
                reason
                staffId
                status
                to
                workItemId
            }
            myShifts {
                checkedIn
                date
                end
                id
                positionId
                staffId
                start
                status
            }
            openShifts {
                date
                end
                id
                positionId
                staffId
                start
                status
            }
            profileId
            swaps {
                checks
                createdAt
                fromStaffId
                id
                item {
                    decidedPath
                    id
                    resultSummary
                    status
                    summary
                }
                kind
                reason
                shiftId
                shiftLine
                status
                toStaffId
                workItemId
            }
            today
        }
    }
`

enum QueryShiftsMine {
    Query1 = "query1",
}

const queryMap: Record<QueryShiftsMine, TypedDocumentNode<QueryShiftsMineResponse>> = {
    [QueryShiftsMine.Query1]: query1,
}

/** Apollo params for {@link queryShiftsMine}. */
type QueryShiftsMineParams = QueryParams<QueryShiftsMine>

/** Runs the `shiftsMine` query. */
export const queryShiftsMine = async ({ query = QueryShiftsMine.Query1, signal }: QueryShiftsMineParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
