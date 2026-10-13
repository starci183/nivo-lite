import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CancelOfficeCommandMutation, CancelOfficeCommandMutationVariables } from "../__generated__/graphql"

/** The input of the `cancelOfficeCommand` mutation. */
export type MutateCancelOfficeCommandRequest = WireInput<CancelOfficeCommandMutationVariables["input"]>

type MutateCancelOfficeCommandResponse = CancelOfficeCommandMutation

const mutation1: TypedDocumentNode<
    MutateCancelOfficeCommandResponse,
    InputVariables<MutateCancelOfficeCommandRequest>
> = gql`
    mutation CancelOfficeCommand($input: OfficeCandidateIdInput!) {
        cancelOfficeCommand(input: $input) {
            ok
        }
    }
`

enum MutationCancelOfficeCommand {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCancelOfficeCommand,
    TypedDocumentNode<MutateCancelOfficeCommandResponse, InputVariables<MutateCancelOfficeCommandRequest>>
> = {
    [MutationCancelOfficeCommand.Mutation1]: mutation1,
}

/** The back end `cancelOfficeCommand` mutation. */
export const mutateCancelOfficeCommand = async ({
    mutation = MutationCancelOfficeCommand.Mutation1,
    request,
    signal,
}: MutateParams<MutationCancelOfficeCommand, MutateCancelOfficeCommandRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
