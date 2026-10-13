import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationInstallModuleArgs } from "../__generated__/schema"

/** The input of the `installModule` mutation. */
export type MutateInstallModuleRequest = MutationInstallModuleArgs["input"]

type MutateInstallModuleResponse = Pick<Mutation, "installModule">

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
}: MutateParams<MutationInstallModule, MutateInstallModuleRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
