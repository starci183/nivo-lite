import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateHiringCvUploadMutation, CreateHiringCvUploadMutationVariables } from "../__generated__/graphql"

/** The input of the `createHiringCvUpload` mutation. */
export type MutateCreateHiringCvUploadRequest = WireInput<CreateHiringCvUploadMutationVariables["input"]>

/** The response of the `createHiringCvUpload` mutation. */
type MutateCreateHiringCvUploadResponse = CreateHiringCvUploadMutation

const mutation1: TypedDocumentNode<
    MutateCreateHiringCvUploadResponse,
    InputVariables<MutateCreateHiringCvUploadRequest>
> = gql`
    mutation CreateHiringCvUpload($input: CreateHiringCvUploadInput!) {
        createHiringCvUpload(input: $input) {
            path
            token
        }
    }
`

enum MutationCreateHiringCvUpload {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateHiringCvUpload,
    TypedDocumentNode<MutateCreateHiringCvUploadResponse, InputVariables<MutateCreateHiringCvUploadRequest>>
> = {
    [MutationCreateHiringCvUpload.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateHiringCvUpload}. */
type MutateCreateHiringCvUploadParams = MutateParams<MutationCreateHiringCvUpload, MutateCreateHiringCvUploadRequest>

/** Runs the `createHiringCvUpload` mutation (anonymous public door). */
export const mutateCreateHiringCvUpload = async ({
    mutation = MutationCreateHiringCvUpload.Mutation1,
    request,
    signal,
}: MutateCreateHiringCvUploadParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
