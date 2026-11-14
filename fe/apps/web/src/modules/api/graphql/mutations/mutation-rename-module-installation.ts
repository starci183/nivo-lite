import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type {
    RenameModuleInstallationMutation,
    RenameModuleInstallationMutationVariables,
} from "../__generated__/graphql"

/** The input of the `renameModuleInstallation` mutation. */
export type MutateRenameModuleInstallationRequest = WireInput<RenameModuleInstallationMutationVariables["input"]>

type MutateRenameModuleInstallationResponse = RenameModuleInstallationMutation

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
            lifecycle
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
}: MutateParams<MutationRenameModuleInstallation, MutateRenameModuleInstallationRequest>): Promise<
    ApolloClient.MutateResult<MutateRenameModuleInstallationResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
