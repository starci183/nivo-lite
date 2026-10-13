import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveTelegramUserSetupMutation, SaveTelegramUserSetupMutationVariables } from "../__generated__/graphql"

/** The input of the `saveTelegramUserSetup` mutation. */
type MutateSaveTelegramUserSetupRequest = WireInput<SaveTelegramUserSetupMutationVariables["input"]>

/** The response of the `saveTelegramUserSetup` mutation. */
type MutateSaveTelegramUserSetupResponse = SaveTelegramUserSetupMutation

const mutation1: TypedDocumentNode<
    MutateSaveTelegramUserSetupResponse,
    InputVariables<MutateSaveTelegramUserSetupRequest>
> = gql`
    mutation SaveTelegramUserSetup($input: SaveTelegramUserSetupInput!) {
        saveTelegramUserSetup(input: $input)
    }
`

enum MutationSaveTelegramUserSetup {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveTelegramUserSetup,
    TypedDocumentNode<MutateSaveTelegramUserSetupResponse, InputVariables<MutateSaveTelegramUserSetupRequest>>
> = {
    [MutationSaveTelegramUserSetup.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveTelegramUserSetup}. */
type SaveTelegramUserSetupParams = MutateParams<MutationSaveTelegramUserSetup, MutateSaveTelegramUserSetupRequest>

/** Saves the chosen Telegram chats and schedule. */
export const mutateSaveTelegramUserSetup = async ({
    mutation = MutationSaveTelegramUserSetup.Mutation1,
    request,
    signal,
}: SaveTelegramUserSetupParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
