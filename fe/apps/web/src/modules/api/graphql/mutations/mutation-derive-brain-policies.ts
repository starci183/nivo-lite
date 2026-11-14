import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type MutateParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DeriveBrainPoliciesMutation } from "../__generated__/graphql"

type Document = TypedDocumentNode<DeriveBrainPoliciesMutation, Record<string, never>>

const mutation1: Document = gql`
    mutation DeriveBrainPolicies {
        deriveBrainPolicies {
            outcome
        }
    }
`

enum MutationDeriveBrainPolicies {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDeriveBrainPolicies, Document> = {
    [MutationDeriveBrainPolicies.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeriveBrainPolicies}. */
type MutateDeriveBrainPoliciesParams = Omit<MutateParams<MutationDeriveBrainPolicies, undefined>, "request">

/** Queues one pass that derives the shop's policies from the truth graph (no input); it answers at once, never waits for the model. */
export const mutateDeriveBrainPolicies = async ({
    mutation = MutationDeriveBrainPolicies.Mutation1,
    signal,
}: MutateDeriveBrainPoliciesParams = {}): Promise<ApolloClient.MutateResult<DeriveBrainPoliciesMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
