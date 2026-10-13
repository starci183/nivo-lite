import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ArchiveVideoProjectMutation, ArchiveVideoProjectMutationVariables } from "../__generated__/graphql"

/** The input of the `archiveVideoProject` mutation. */
type MutateArchiveVideoProjectRequest = WireInput<ArchiveVideoProjectMutationVariables["input"]>

/** The generated payload of the `archiveVideoProject` mutation. */
type MutateArchiveVideoProjectResponse = ArchiveVideoProjectMutation

type Document = TypedDocumentNode<MutateArchiveVideoProjectResponse, InputVariables<MutateArchiveVideoProjectRequest>>

const mutation1: Document = gql`
    mutation ArchiveVideoProject($input: ArchiveVideoProjectInput!) {
        archiveVideoProject(input: $input) {
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

enum MutationArchiveVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationArchiveVideoProject, Document> = {
    [MutationArchiveVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `archiveVideoProject` mutation. */
type MutateArchiveVideoProjectParams = MutateParams<MutationArchiveVideoProject, MutateArchiveVideoProjectRequest>

/** Calls `archiveVideoProject` through the authenticated back end GraphQL API. */
export const mutateArchiveVideoProject = async ({
    mutation = MutationArchiveVideoProject.Mutation1,
    request,
    signal,
}: MutateArchiveVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
