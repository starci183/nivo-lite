import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkVideoPublishedMutation, MarkVideoPublishedMutationVariables } from "../__generated__/graphql"

/** The input of the `markVideoPublished` mutation. */
type MutateMarkVideoPublishedRequest = WireInput<MarkVideoPublishedMutationVariables["input"]>

/** The generated payload of the `markVideoPublished` mutation. */
type MutateMarkVideoPublishedResponse = MarkVideoPublishedMutation

type Document = TypedDocumentNode<MutateMarkVideoPublishedResponse, InputVariables<MutateMarkVideoPublishedRequest>>

const mutation1: Document = gql`
    mutation MarkVideoPublished($input: MarkVideoPublishedInput!) {
        markVideoPublished(input: $input) {
            approvedAt
            approvedByName
            aspect
            createdAt
            goal
            id
            inputs {
                auto
                media
                notes
                sourceIds
            }
            lastErrorCode
            publishedAt
            render {
                downloadUrl
                durationMs
                errorCode
                id
                posterUrl
                progress
                sizeBytes
                stage
                status
                videoUrl
            }
            renderCount
            script {
                caption
                id
                media
                role
                visual
                voiceover
            }
            scriptMs
            status
            targetSeconds
            title
            updatedAt
            version
        }
    }
`

enum MutationMarkVideoPublished {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMarkVideoPublished, Document> = {
    [MutationMarkVideoPublished.Mutation1]: mutation1,
}

/** Apollo options for the `markVideoPublished` mutation. */
type MutateMarkVideoPublishedParams = MutateParams<MutationMarkVideoPublished, MutateMarkVideoPublishedRequest>

/** Calls `markVideoPublished` through the authenticated back end GraphQL API. */
export const mutateMarkVideoPublished = async ({
    mutation = MutationMarkVideoPublished.Mutation1,
    request,
    signal,
}: MutateMarkVideoPublishedParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
