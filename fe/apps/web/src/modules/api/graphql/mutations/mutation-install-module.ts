import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { InstallModuleMutation, InstallModuleMutationVariables } from "../__generated__/graphql"

/** The input of the `installModule` mutation. */
export type MutateInstallModuleRequest = WireInput<InstallModuleMutationVariables["input"]>

type MutateInstallModuleResponse = InstallModuleMutation

const mutation1: TypedDocumentNode<MutateInstallModuleResponse, InputVariables<MutateInstallModuleRequest>> = gql`
    mutation InstallModule($input: InstallModuleInput!) {
        installModule(input: $input) {
            agentId
            created
            installationId
        }
    }
`

enum MutationInstallModule {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationInstallModule,
    TypedDocumentNode<MutateInstallModuleResponse, InputVariables<MutateInstallModuleRequest>>
> = {
    [MutationInstallModule.Mutation1]: mutation1,
}

/** The back end `installModule` mutation. */
export const mutateInstallModule = async ({
    mutation = MutationInstallModule.Mutation1,
    request,
    signal,
}: MutateParams<MutationInstallModule, MutateInstallModuleRequest>): Promise<
    ApolloClient.MutateResult<MutateInstallModuleResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
