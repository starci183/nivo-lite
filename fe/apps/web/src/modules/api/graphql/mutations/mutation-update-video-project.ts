import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationUpdateVideoProjectArgs } from "../__generated__/schema"

/** The input of the `updateVideoProject` mutation. */
export type MutateUpdateVideoProjectRequest = MutationUpdateVideoProjectArgs["input"]

/** The generated payload of the `updateVideoProject` mutation. */
type MutateUpdateVideoProjectResponse = Pick<Mutation, "updateVideoProject">

type Document = TypedDocumentNode<MutateUpdateVideoProjectResponse, InputVariables<MutateUpdateVideoProjectRequest>>

const mutation1: Document = gql`
    mutation UpdateVideoProject($input: UpdateVideoProjectInput!) {
        updateVideoProject(input: $input) {
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

enum MutationUpdateVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateVideoProject, Document> = {
    [MutationUpdateVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `updateVideoProject` mutation. */
type MutateUpdateVideoProjectParams = MutateParams<MutationUpdateVideoProject, MutateUpdateVideoProjectRequest>

/** Calls `updateVideoProject` through the authenticated back end GraphQL API. */
export const mutateUpdateVideoProject = async ({
    mutation = MutationUpdateVideoProject.Mutation1,
    request,
    signal,
}: MutateUpdateVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
