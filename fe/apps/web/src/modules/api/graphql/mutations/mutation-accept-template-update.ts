import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AcceptTemplateUpdateMutation, AcceptTemplateUpdateMutationVariables } from "../__generated__/graphql"

/** The response of the `acceptTemplateUpdate` mutation: the typed payload straight from the back end contract. */
type MutateAcceptTemplateUpdateResponse = AcceptTemplateUpdateMutation

/** The input of the `acceptTemplateUpdate` mutation. */
export type MutateAcceptTemplateUpdateRequest = WireInput<AcceptTemplateUpdateMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateAcceptTemplateUpdateResponse,
    InputVariables<MutateAcceptTemplateUpdateRequest>
> = gql`
    mutation AcceptTemplateUpdate($input: AcceptTemplateUpdateInput!) {
        acceptTemplateUpdate(input: $input) {
            installationId
            key
            installed
            offered
            breaking
            changelog
            units {
                id
                nodeKey
                branchKey
                change
            }
        }
    }
`

enum MutationAcceptTemplateUpdate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAcceptTemplateUpdate,
    TypedDocumentNode<MutateAcceptTemplateUpdateResponse, InputVariables<MutateAcceptTemplateUpdateRequest>>
> = {
    [MutationAcceptTemplateUpdate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAcceptTemplateUpdate}. */
type MutateAcceptTemplateUpdateParams = MutateParams<MutationAcceptTemplateUpdate, MutateAcceptTemplateUpdateRequest>

/** The back end `acceptTemplateUpdate` mutation. Rejects with the back end failure (message localized by the server). */
export const mutateAcceptTemplateUpdate = async ({
    mutation = MutationAcceptTemplateUpdate.Mutation1,
    request,
    signal,
}: MutateAcceptTemplateUpdateParams): Promise<ApolloClient.MutateResult<MutateAcceptTemplateUpdateResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
