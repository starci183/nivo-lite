import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DeleteContactMutation, DeleteContactMutationVariables } from "../__generated__/graphql"

/** The input of the `deleteContact` mutation. */
type MutateDeleteContactRequest = WireInput<DeleteContactMutationVariables["input"]>

/** The response of the `deleteContact` mutation: the typed payload straight from the back end contract. */
type MutateDeleteContactResponse = DeleteContactMutation

type Document = TypedDocumentNode<MutateDeleteContactResponse, InputVariables<MutateDeleteContactRequest>>

const mutation1: Document = gql`
    mutation DeleteContact($input: DeleteContactInput!) {
        deleteContact(input: $input)
    }
`

enum MutationDeleteContact {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDeleteContact, Document> = {
    [MutationDeleteContact.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteContact}. */
type MutateDeleteContactParams = MutateParams<MutationDeleteContact, MutateDeleteContactRequest>

/** Deletes a person with their identities and agent memory (the back end `deleteContact` mutation, owner only). */
export const mutateDeleteContact = async ({
    mutation = MutationDeleteContact.Mutation1,
    request,
    signal,
}: MutateDeleteContactParams): Promise<ApolloClient.MutateResult<MutateDeleteContactResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
