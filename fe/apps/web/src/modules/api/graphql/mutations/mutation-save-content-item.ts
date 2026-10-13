import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveContentItemMutation, SaveContentItemMutationVariables } from "../__generated__/graphql"

/** The input of the `saveContentItem` mutation. */
export type MutateSaveContentItemRequest = WireInput<SaveContentItemMutationVariables["input"]>

/** The generated payload of the `saveContentItem` mutation. */
type MutateSaveContentItemResponse = SaveContentItemMutation

type Document = TypedDocumentNode<MutateSaveContentItemResponse, InputVariables<MutateSaveContentItemRequest>>

const mutation1: Document = gql`
    mutation SaveContentItem($input: SaveContentItemInput!) {
        saveContentItem(input: $input) {
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

enum MutationSaveContentItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveContentItem, Document> = {
    [MutationSaveContentItem.Mutation1]: mutation1,
}

/** Apollo options for the `saveContentItem` mutation. */
type MutateSaveContentItemParams = MutateParams<MutationSaveContentItem, MutateSaveContentItemRequest> & {
    request: MutateSaveContentItemRequest
}

/** Runs `saveContentItem` through the authenticated back end GraphQL API. */
export const mutateSaveContentItem = async ({
    mutation = MutationSaveContentItem.Mutation1,
    request,
    signal,
}: MutateSaveContentItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
