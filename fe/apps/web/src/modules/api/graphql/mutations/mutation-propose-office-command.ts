import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ProposeOfficeCommandMutation, ProposeOfficeCommandMutationVariables } from "../__generated__/graphql"

/** The input of the `proposeOfficeCommand` mutation. */
export type MutateProposeOfficeCommandRequest = WireInput<ProposeOfficeCommandMutationVariables["input"]>

type MutateProposeOfficeCommandResponse = ProposeOfficeCommandMutation

const mutation1: TypedDocumentNode<
    MutateProposeOfficeCommandResponse,
    InputVariables<MutateProposeOfficeCommandRequest>
> = gql`
    mutation ProposeOfficeCommand($input: ProposeOfficeCommandInput!) {
        proposeOfficeCommand(input: $input) {
            body
            candidate {
                command
                created_at
                id
                message_id
                module
                payload
                refusal_detail
                shown {
                    key
                    label
                    value
                }
                status
                summary
                work_item_id
            }
            kind
        }
    }
`

enum MutationProposeOfficeCommand {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationProposeOfficeCommand,
    TypedDocumentNode<MutateProposeOfficeCommandResponse, InputVariables<MutateProposeOfficeCommandRequest>>
> = {
    [MutationProposeOfficeCommand.Mutation1]: mutation1,
}

/** The back end `proposeOfficeCommand` mutation. */
export const mutateProposeOfficeCommand = async ({
    mutation = MutationProposeOfficeCommand.Mutation1,
    request,
    signal,
}: MutateParams<MutationProposeOfficeCommand, MutateProposeOfficeCommandRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
