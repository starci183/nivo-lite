import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateContentItemMutation, CreateContentItemMutationVariables } from "../__generated__/graphql"

/** The input of the `createContentItem` mutation. */
export type MutateCreateContentItemRequest = WireInput<CreateContentItemMutationVariables["input"]>

/** The generated payload of the `createContentItem` mutation. */
type MutateCreateContentItemResponse = CreateContentItemMutation

type Document = TypedDocumentNode<MutateCreateContentItemResponse, InputVariables<MutateCreateContentItemRequest>>

const mutation1: Document = gql`
    mutation CreateContentItem($input: CreateContentItemInput!) {
        createContentItem(input: $input) {
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

enum MutationCreateContentItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateContentItem, Document> = {
    [MutationCreateContentItem.Mutation1]: mutation1,
}

/** Apollo options for the `createContentItem` mutation. */
type MutateCreateContentItemParams = MutateParams<MutationCreateContentItem, MutateCreateContentItemRequest> & {
    request: MutateCreateContentItemRequest
}

/** Runs `createContentItem` through the authenticated back end GraphQL API. */
export const mutateCreateContentItem = async ({
    mutation = MutationCreateContentItem.Mutation1,
    request,
    signal,
}: MutateCreateContentItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
