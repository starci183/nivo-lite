import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDuplicateVideoProjectArgs } from "../__generated__/schema"

/** The input of the `duplicateVideoProject` mutation. */
type MutateDuplicateVideoProjectRequest = MutationDuplicateVideoProjectArgs["input"]

/** The generated payload of the `duplicateVideoProject` mutation. */
type MutateDuplicateVideoProjectResponse = Pick<Mutation, "duplicateVideoProject">

type Document = TypedDocumentNode<
    MutateDuplicateVideoProjectResponse,
    InputVariables<MutateDuplicateVideoProjectRequest>
>

const mutation1: Document = gql`
    mutation DuplicateVideoProject($input: DuplicateVideoProjectInput!) {
        duplicateVideoProject(input: $input) {
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

enum MutationDuplicateVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDuplicateVideoProject, Document> = {
    [MutationDuplicateVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `duplicateVideoProject` mutation. */
type MutateDuplicateVideoProjectParams = MutateParams<MutationDuplicateVideoProject, MutateDuplicateVideoProjectRequest>

/** Calls `duplicateVideoProject` through the authenticated back end GraphQL API. */
export const mutateDuplicateVideoProject = async ({
    mutation = MutationDuplicateVideoProject.Mutation1,
    request,
    signal,
}: MutateDuplicateVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
