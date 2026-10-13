import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationConfirmOfficeCommandArgs } from "../__generated__/schema"

/** The input of the `confirmOfficeCommand` mutation. */
export type MutateConfirmOfficeCommandRequest = MutationConfirmOfficeCommandArgs["input"]

type MutateConfirmOfficeCommandResponse = Pick<Mutation, "confirmOfficeCommand">

const mutation1: TypedDocumentNode<
    MutateConfirmOfficeCommandResponse,
    InputVariables<MutateConfirmOfficeCommandRequest>
> = gql`
    mutation ConfirmOfficeCommand($input: OfficeCandidateIdInput!) {
        confirmOfficeCommand(input: $input) {
            created
            module
            workItemId
        }
    }
`

enum MutationConfirmOfficeCommand {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationConfirmOfficeCommand,
    TypedDocumentNode<MutateConfirmOfficeCommandResponse, InputVariables<MutateConfirmOfficeCommandRequest>>
> = {
    [MutationConfirmOfficeCommand.Mutation1]: mutation1,
}

/** The back end `confirmOfficeCommand` mutation. */
export const mutateConfirmOfficeCommand = async ({
    mutation = MutationConfirmOfficeCommand.Mutation1,
    request,
    signal,
}: MutateParams<MutationConfirmOfficeCommand, MutateConfirmOfficeCommandRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
