import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ArchivePublicDocumentMutation, ArchivePublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `archivePublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateArchivePublicDocumentResponse = ArchivePublicDocumentMutation

/** The input of the `archivePublicDocument` mutation. */
export type MutateArchivePublicDocumentRequest = WireInput<ArchivePublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateArchivePublicDocumentResponse,
    InputVariables<MutateArchivePublicDocumentRequest>
> = gql`
    mutation ArchivePublicDocument($input: PublicDocumentIdInput!) {
        archivePublicDocument(input: $input)
    }
`

enum MutationArchivePublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationArchivePublicDocument,
    TypedDocumentNode<MutateArchivePublicDocumentResponse, InputVariables<MutateArchivePublicDocumentRequest>>
> = {
    [MutationArchivePublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateArchivePublicDocument}. */
type MutateArchivePublicDocumentParams = MutateParams<MutationArchivePublicDocument, MutateArchivePublicDocumentRequest>

/**
 * Takes a public document away from customers (the back end `archivePublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateArchivePublicDocument = async ({
    mutation = MutationArchivePublicDocument.Mutation1,
    request,
    signal,
}: MutateArchivePublicDocumentParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
