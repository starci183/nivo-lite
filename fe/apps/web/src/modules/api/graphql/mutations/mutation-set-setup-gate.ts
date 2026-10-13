import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetSetupGateArgs } from "../__generated__/schema"

/** The input of the `setSetupGate` mutation. */
export type MutateSetSetupGateRequest = MutationSetSetupGateArgs["input"]

type MutateSetSetupGateResponse = Pick<Mutation, "setSetupGate">

const mutation1: TypedDocumentNode<MutateSetSetupGateResponse, InputVariables<MutateSetSetupGateRequest>> = gql`
    mutation SetSetupGate($input: SetSetupGateInput!) {
        setSetupGate(input: $input) {
            createdAt
            draft {
                facts {
                    key
                    text
                }
                summary
            }
            gateEvidence
            id
            installationId
            revision
            status
            workspaceId
        }
    }
`

enum MutationSetSetupGate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetSetupGate,
    TypedDocumentNode<MutateSetSetupGateResponse, InputVariables<MutateSetSetupGateRequest>>
> = {
    [MutationSetSetupGate.Mutation1]: mutation1,
}

/** The back end `setSetupGate` mutation. */
export const mutateSetSetupGate = async ({
    mutation = MutationSetSetupGate.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetSetupGate, MutateSetSetupGateRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
