import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SaveWorkingHoursMutation, SaveWorkingHoursMutationVariables } from "../__generated__/graphql"

/** The input of the `saveWorkingHours` mutation. */
export type MutateSaveWorkingHoursRequest = WireInput<SaveWorkingHoursMutationVariables["input"]>

type MutateSaveWorkingHoursResponse = SaveWorkingHoursMutation

const mutation1: TypedDocumentNode<
    MutateSaveWorkingHoursResponse,
    InputVariables<MutateSaveWorkingHoursRequest>
> = gql`
    mutation SaveWorkingHours($input: SaveWorkingHoursInput!) {
        saveWorkingHours(input: $input) {
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

enum MutationSaveWorkingHours {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveWorkingHours,
    TypedDocumentNode<MutateSaveWorkingHoursResponse, InputVariables<MutateSaveWorkingHoursRequest>>
> = {
    [MutationSaveWorkingHours.Mutation1]: mutation1,
}

/** The back end `saveWorkingHours` mutation. */
export const mutateSaveWorkingHours = async ({
    mutation = MutationSaveWorkingHours.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveWorkingHours, MutateSaveWorkingHoursRequest>): Promise<
    ApolloClient.MutateResult<MutateSaveWorkingHoursResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
