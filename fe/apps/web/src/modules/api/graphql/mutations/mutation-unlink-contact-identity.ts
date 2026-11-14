import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { UnlinkContactIdentityMutation, UnlinkContactIdentityMutationVariables } from "../__generated__/graphql"

/** The input of the `unlinkContactIdentity` mutation. */
type MutateUnlinkContactIdentityRequest = WireInput<UnlinkContactIdentityMutationVariables["input"]>

/** The response of the `unlinkContactIdentity` mutation: the typed payload straight from the back end contract. */
type MutateUnlinkContactIdentityResponse = UnlinkContactIdentityMutation

type Document = TypedDocumentNode<
    MutateUnlinkContactIdentityResponse,
    InputVariables<MutateUnlinkContactIdentityRequest>
>

const mutation1: Document = gql`
    mutation UnlinkContactIdentity($input: UnlinkContactIdentityInput!) {
        unlinkContactIdentity(input: $input) {
            id
            displayName
            tags
            createdAt
            updatedAt
            identities {
                id
                kind
                provider
                account
                value
                verified
                verifiedBy
                source
                joinedBy
                at
            }
        }
    }
`

enum MutationUnlinkContactIdentity {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUnlinkContactIdentity, Document> = {
    [MutationUnlinkContactIdentity.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUnlinkContactIdentity}. */
type MutateUnlinkContactIdentityParams = MutateParams<MutationUnlinkContactIdentity, MutateUnlinkContactIdentityRequest>

/** Takes one identity off a person (the back end `unlinkContactIdentity` mutation). */
export const mutateUnlinkContactIdentity = async ({
    mutation = MutationUnlinkContactIdentity.Mutation1,
    request,
    signal,
}: MutateUnlinkContactIdentityParams): Promise<ApolloClient.MutateResult<MutateUnlinkContactIdentityResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
