import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationKeepCurrentBrainFactArgs } from "../__generated__/schema"

/** The response of the `keepCurrentBrainFact` mutation: the typed payload straight from the back end contract. */
type MutateKeepCurrentBrainFactResponse = Pick<Mutation, "keepCurrentBrainFact">

/** The input of the `keepCurrentBrainFact` mutation. */
export type MutateKeepCurrentBrainFactRequest = MutationKeepCurrentBrainFactArgs["input"]

const mutation1: TypedDocumentNode<
    MutateKeepCurrentBrainFactResponse,
    InputVariables<MutateKeepCurrentBrainFactRequest>
> = gql`
    mutation KeepCurrentBrainFact($input: KeepCurrentBrainFactInput!) {
        keepCurrentBrainFact(input: $input)
    }
`

enum MutationKeepCurrentBrainFact {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationKeepCurrentBrainFact,
    TypedDocumentNode<MutateKeepCurrentBrainFactResponse, InputVariables<MutateKeepCurrentBrainFactRequest>>
> = {
    [MutationKeepCurrentBrainFact.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateKeepCurrentBrainFact}. */
type MutateKeepCurrentBrainFactParams = MutateParams<MutationKeepCurrentBrainFact, MutateKeepCurrentBrainFactRequest>

/**
 * Keeps the value in force of one subject and attribute and retires the proposals competing for it (the back end
 * `keepCurrentBrainFact` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by
 * the server).
 */
export const mutateKeepCurrentBrainFact = async ({
    mutation = MutationKeepCurrentBrainFact.Mutation1,
    request,
    signal,
}: MutateKeepCurrentBrainFactParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
