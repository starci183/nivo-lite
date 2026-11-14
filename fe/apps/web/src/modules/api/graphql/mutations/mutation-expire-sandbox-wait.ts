import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ExpireSandboxWaitMutation, ExpireSandboxWaitMutationVariables } from "../__generated__/graphql"

/** The input of the `expireSandboxWait` mutation. */
export type MutateExpireSandboxWaitRequest = WireInput<ExpireSandboxWaitMutationVariables["input"]>

/** The response of the `expireSandboxWait` mutation: the typed payload straight from the back end contract. */
type MutateExpireSandboxWaitResponse = ExpireSandboxWaitMutation

type Document = TypedDocumentNode<MutateExpireSandboxWaitResponse, InputVariables<MutateExpireSandboxWaitRequest>>

const mutation1: Document = gql`
    mutation ExpireSandboxWait($input: ExpireSandboxWaitInput!) {
        expireSandboxWait(input: $input) {
            runId
            outcome
        }
    }
`

enum MutationExpireSandboxWait {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationExpireSandboxWait, Document> = { [MutationExpireSandboxWait.Mutation1]: mutation1 }

/** Apollo params for {@link mutateExpireSandboxWait}. */
type MutateExpireSandboxWaitParams = MutateParams<MutationExpireSandboxWait, MutateExpireSandboxWaitRequest>

/** Ends the wait a run is parked at now, through the real deadline road (the back end `expireSandboxWait` mutation, owner and manager). */
export const mutateExpireSandboxWait = async ({
    mutation = MutationExpireSandboxWait.Mutation1,
    request,
    signal,
}: MutateExpireSandboxWaitParams): Promise<ApolloClient.MutateResult<MutateExpireSandboxWaitResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
