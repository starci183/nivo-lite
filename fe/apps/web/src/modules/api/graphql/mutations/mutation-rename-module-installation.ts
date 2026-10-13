import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRenameModuleInstallationArgs } from "../__generated__/schema"

/** The input of the `renameModuleInstallation` mutation. */
export type MutateRenameModuleInstallationRequest = MutationRenameModuleInstallationArgs["input"]

type MutateRenameModuleInstallationResponse = Pick<Mutation, "renameModuleInstallation">

const mutation1: TypedDocumentNode<
    MutateRenameModuleInstallationResponse,
    InputVariables<MutateRenameModuleInstallationRequest>
> = gql`
    mutation RenameModuleInstallation($input: RenameModuleInstallationInput!) {
        renameModuleInstallation(input: $input) {
            activeContextVersionId
            activeVersion
            agentHandle
            agentId
            agentName
            createdAt
            id
            isMulti
            liveEnabled
            moduleKey
            name
            operatingMode
            settings
            status
            workspaceId
        }
    }
`

enum MutationRenameModuleInstallation {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRenameModuleInstallation,
    TypedDocumentNode<MutateRenameModuleInstallationResponse, InputVariables<MutateRenameModuleInstallationRequest>>
> = {
    [MutationRenameModuleInstallation.Mutation1]: mutation1,
}

/** The back end `renameModuleInstallation` mutation. */
export const mutateRenameModuleInstallation = async ({
    mutation = MutationRenameModuleInstallation.Mutation1,
    request,
    signal,
}: MutateParams<MutationRenameModuleInstallation, MutateRenameModuleInstallationRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
