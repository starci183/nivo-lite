import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetSandboxNextCaseMutation, SetSandboxNextCaseMutationVariables } from "../__generated__/graphql"

/** The input of the `setSandboxNextCase` mutation. */
export type MutateSetSandboxNextCaseRequest = WireInput<SetSandboxNextCaseMutationVariables["input"]>

/** The response of the `setSandboxNextCase` mutation: the typed payload straight from the back end contract. */
type MutateSetSandboxNextCaseResponse = SetSandboxNextCaseMutation

type Document = TypedDocumentNode<MutateSetSandboxNextCaseResponse, InputVariables<MutateSetSandboxNextCaseRequest>>

const mutation1: Document = gql`
    mutation SetSandboxNextCase($input: SetSandboxNextCaseInput!) {
        setSandboxNextCase(input: $input) {
            operation
            caseId
            isDefault
        }
    }
`

enum MutationSetSandboxNextCase {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetSandboxNextCase, Document> = { [MutationSetSandboxNextCase.Mutation1]: mutation1 }

/** Apollo params for {@link mutateSetSandboxNextCase}. */
type MutateSetSandboxNextCaseParams = MutateParams<MutationSetSandboxNextCase, MutateSetSandboxNextCaseRequest>

/** Chooses the case an outbound operation of a sandbox account answers next (the back end `setSandboxNextCase` mutation, owner and manager). */
export const mutateSetSandboxNextCase = async ({
    mutation = MutationSetSandboxNextCase.Mutation1,
    request,
    signal,
}: MutateSetSandboxNextCaseParams): Promise<ApolloClient.MutateResult<MutateSetSandboxNextCaseResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
