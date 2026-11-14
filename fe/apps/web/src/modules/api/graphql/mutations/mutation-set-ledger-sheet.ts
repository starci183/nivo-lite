import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetLedgerSheetMutation, SetLedgerSheetMutationVariables } from "../__generated__/graphql"

/** The input of the `setLedgerSheet` mutation. */
type MutateSetLedgerSheetRequest = WireInput<SetLedgerSheetMutationVariables["input"]>

/** The response of the `setLedgerSheet` mutation. */
type MutateSetLedgerSheetResponse = SetLedgerSheetMutation

const mutation1: TypedDocumentNode<MutateSetLedgerSheetResponse, InputVariables<MutateSetLedgerSheetRequest>> = gql`
    mutation SetLedgerSheet($input: SetLedgerSheetInput!) {
        setLedgerSheet(input: $input) {
            state
            email
            sheetId
            sheetUrl
        }
    }
`

enum MutationSetLedgerSheet {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetLedgerSheet,
    TypedDocumentNode<MutateSetLedgerSheetResponse, InputVariables<MutateSetLedgerSheetRequest>>
> = {
    [MutationSetLedgerSheet.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetLedgerSheet}. */
type MutateSetLedgerSheetParams = MutateParams<MutationSetLedgerSheet, MutateSetLedgerSheetRequest>

/** Names the Google spreadsheet the ledger is written to (owner) and answers where the ledger stands now. */
export const mutateSetLedgerSheet = async ({
    mutation = MutationSetLedgerSheet.Mutation1,
    request,
    signal,
}: MutateSetLedgerSheetParams): Promise<ApolloClient.MutateResult<MutateSetLedgerSheetResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
