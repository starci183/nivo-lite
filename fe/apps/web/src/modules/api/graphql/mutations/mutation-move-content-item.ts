import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationMoveContentItemArgs } from "../__generated__/schema"

/** The input of the `moveContentItem` mutation. */
type MutateMoveContentItemRequest = MutationMoveContentItemArgs["input"]

/** The generated payload of the `moveContentItem` mutation. */
type MutateMoveContentItemResponse = Pick<Mutation, "moveContentItem">

type Document = TypedDocumentNode<MutateMoveContentItemResponse, InputVariables<MutateMoveContentItemRequest>>

const mutation1: Document = gql`
    mutation MoveContentItem($input: MoveContentItemInput!) {
        moveContentItem(input: $input) {
            approvedAt
            approvedBy
            brief
            channels
            createdAt
            createdBy
            draftedAt
            evidence {
                at
                by
                kind
                text
            }
            hashtags
            holidayKey
            id
            links {
                label
                url
            }
            media {
                id
                kind
                name
                path
                suggested
            }
            pillarId
            planId
            published {
                at
                by
                channel
                how
                url
            }
            publishedAt
            scheduledAt
            source
            status
            title
            updatedAt
            variants {
                channel
                hashtags
                note
                text
            }
            workItemId
            workspaceId
        }
    }
`

enum MutationMoveContentItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMoveContentItem, Document> = {
    [MutationMoveContentItem.Mutation1]: mutation1,
}

/** Apollo options for the `moveContentItem` mutation. */
type MutateMoveContentItemParams = MutateParams<MutationMoveContentItem, MutateMoveContentItemRequest> & {
    request: MutateMoveContentItemRequest
}

/** Runs `moveContentItem` through the authenticated back end GraphQL API. */
export const mutateMoveContentItem = async ({
    mutation = MutationMoveContentItem.Mutation1,
    request,
    signal,
}: MutateMoveContentItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
