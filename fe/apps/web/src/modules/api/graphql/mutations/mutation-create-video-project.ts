import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCreateVideoProjectArgs } from "../__generated__/schema"

/** The input of the `createVideoProject` mutation. */
export type MutateCreateVideoProjectRequest = MutationCreateVideoProjectArgs["input"]

/** The generated payload of the `createVideoProject` mutation. */
type MutateCreateVideoProjectResponse = Pick<Mutation, "createVideoProject">

type Document = TypedDocumentNode<MutateCreateVideoProjectResponse, InputVariables<MutateCreateVideoProjectRequest>>

const mutation1: Document = gql`
    mutation CreateVideoProject($input: CreateVideoProjectInput!) {
        createVideoProject(input: $input) {
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

enum MutationCreateVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateVideoProject, Document> = {
    [MutationCreateVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `createVideoProject` mutation. */
type MutateCreateVideoProjectParams = MutateParams<MutationCreateVideoProject, MutateCreateVideoProjectRequest>

/** Calls `createVideoProject` through the authenticated back end GraphQL API. */
export const mutateCreateVideoProject = async ({
    mutation = MutationCreateVideoProject.Mutation1,
    request,
    signal,
}: MutateCreateVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
