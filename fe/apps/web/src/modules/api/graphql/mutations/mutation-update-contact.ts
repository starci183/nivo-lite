import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { UpdateContactMutation, UpdateContactMutationVariables } from "../__generated__/graphql"

/** The input of the `updateContact` mutation. */
type MutateUpdateContactRequest = WireInput<UpdateContactMutationVariables["input"]>

/** The response of the `updateContact` mutation: the typed payload straight from the back end contract. */
type MutateUpdateContactResponse = UpdateContactMutation

type Document = TypedDocumentNode<MutateUpdateContactResponse, InputVariables<MutateUpdateContactRequest>>

const mutation1: Document = gql`
    mutation UpdateContact($input: UpdateContactInput!) {
        updateContact(input: $input) {
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

enum MutationUpdateContact {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateContact, Document> = {
    [MutationUpdateContact.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateContact}. */
type MutateUpdateContactParams = MutateParams<MutationUpdateContact, MutateUpdateContactRequest>

/** Renames a person or sets their tags (the back end `updateContact` mutation). */
export const mutateUpdateContact = async ({
    mutation = MutationUpdateContact.Mutation1,
    request,
    signal,
}: MutateUpdateContactParams): Promise<ApolloClient.MutateResult<MutateUpdateContactResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
