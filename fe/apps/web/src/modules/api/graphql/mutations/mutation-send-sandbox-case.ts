import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SendSandboxCaseMutation, SendSandboxCaseMutationVariables } from "../__generated__/graphql"

/** The input of the `sendSandboxCase` mutation. */
export type MutateSendSandboxCaseRequest = WireInput<SendSandboxCaseMutationVariables["input"]>

/** The response of the `sendSandboxCase` mutation: the typed payload straight from the back end contract. */
type MutateSendSandboxCaseResponse = SendSandboxCaseMutation

type Document = TypedDocumentNode<MutateSendSandboxCaseResponse, InputVariables<MutateSendSandboxCaseRequest>>

const mutation1: Document = gql`
    mutation SendSandboxCase($input: SendSandboxCaseInput!) {
        sendSandboxCase(input: $input) {
            caseId
            inputs {
                name
                value
            }
            deliveries {
                path
                status
                bodyJson
            }
        }
    }
`

enum MutationSendSandboxCase {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSendSandboxCase, Document> = { [MutationSendSandboxCase.Mutation1]: mutation1 }

/** Apollo params for {@link mutateSendSandboxCase}. */
type MutateSendSandboxCaseParams = MutateParams<MutationSendSandboxCase, MutateSendSandboxCaseRequest>

/** Sends one inbound case of a sandbox account through the provider's own webhook route (the back end `sendSandboxCase` mutation, owner and manager). */
export const mutateSendSandboxCase = async ({
    mutation = MutationSendSandboxCase.Mutation1,
    request,
    signal,
}: MutateSendSandboxCaseParams): Promise<ApolloClient.MutateResult<MutateSendSandboxCaseResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
