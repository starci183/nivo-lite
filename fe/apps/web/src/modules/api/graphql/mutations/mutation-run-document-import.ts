import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RunDocumentImportMutation, RunDocumentImportMutationVariables } from "../__generated__/graphql"

/** The input of the `runDocumentImport` mutation. */
type MutateRunDocumentImportRequest = WireInput<RunDocumentImportMutationVariables["input"]>

/** The response of the `runDocumentImport` mutation. */
type MutateRunDocumentImportResponse = RunDocumentImportMutation

const mutation1: TypedDocumentNode<
    MutateRunDocumentImportResponse,
    InputVariables<MutateRunDocumentImportRequest>
> = gql`
    mutation RunDocumentImport($input: RunDocumentImportInput!) {
        runDocumentImport(input: $input) {
            connectionId
            added
            updated
            skipped
            total
            summary
        }
    }
`

enum MutationRunDocumentImport {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRunDocumentImport,
    TypedDocumentNode<MutateRunDocumentImportResponse, InputVariables<MutateRunDocumentImportRequest>>
> = {
    [MutationRunDocumentImport.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRunDocumentImport}. */
type MutateRunDocumentImportParams = MutateParams<MutationRunDocumentImport, MutateRunDocumentImportRequest>

/** Imports documents (uploaded files and/or a Google Docs link) as document rows. */
export const mutateRunDocumentImport = async ({
    mutation = MutationRunDocumentImport.Mutation1,
    request,
    signal,
}: MutateRunDocumentImportParams): Promise<ApolloClient.MutateResult<MutateRunDocumentImportResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
