import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RestoreAgentGraphVersionMutation,
    RestoreAgentGraphVersionMutationVariables,
} from "../__generated__/graphql"

/** The input of the `restoreAgentGraphVersion` mutation. */
type MutateRestoreAgentGraphVersionRequest = WireInput<RestoreAgentGraphVersionMutationVariables["input"]>

/** The response of the `restoreAgentGraphVersion` mutation: the typed payload straight from the back end contract. */
type MutateRestoreAgentGraphVersionResponse = RestoreAgentGraphVersionMutation

type Document = TypedDocumentNode<
    MutateRestoreAgentGraphVersionResponse,
    InputVariables<MutateRestoreAgentGraphVersionRequest>
>

const mutation1: Document = gql`
    mutation RestoreAgentGraphVersion($input: RestoreAgentGraphVersionInput!) {
        restoreAgentGraphVersion(input: $input) {
            id
            version
        }
    }
`

enum MutationRestoreAgentGraphVersion {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRestoreAgentGraphVersion, Document> = {
    [MutationRestoreAgentGraphVersion.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRestoreAgentGraphVersion}. */
type MutateRestoreAgentGraphVersionParams = MutateParams<
    MutationRestoreAgentGraphVersion,
    MutateRestoreAgentGraphVersionRequest
>

/** The back end `restoreAgentGraphVersion` mutation. */
export const mutateRestoreAgentGraphVersion = async ({
    mutation = MutationRestoreAgentGraphVersion.Mutation1,
    request,
    signal,
}: MutateRestoreAgentGraphVersionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
