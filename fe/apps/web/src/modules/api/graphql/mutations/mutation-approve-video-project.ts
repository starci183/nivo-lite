import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationApproveVideoProjectArgs } from "../__generated__/schema"

/** The input of the `approveVideoProject` mutation. */
type MutateApproveVideoProjectRequest = MutationApproveVideoProjectArgs["input"]

/** The generated payload of the `approveVideoProject` mutation. */
type MutateApproveVideoProjectResponse = Pick<Mutation, "approveVideoProject">

type Document = TypedDocumentNode<MutateApproveVideoProjectResponse, InputVariables<MutateApproveVideoProjectRequest>>

const mutation1: Document = gql`
    mutation ApproveVideoProject($input: ApproveVideoProjectInput!) {
        approveVideoProject(input: $input) {
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

enum MutationApproveVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationApproveVideoProject, Document> = {
    [MutationApproveVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `approveVideoProject` mutation. */
type MutateApproveVideoProjectParams = MutateParams<MutationApproveVideoProject, MutateApproveVideoProjectRequest>

/** Calls `approveVideoProject` through the authenticated back end GraphQL API. */
export const mutateApproveVideoProject = async ({
    mutation = MutationApproveVideoProject.Mutation1,
    request,
    signal,
}: MutateApproveVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
