import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveHiringNotesMutation, SaveHiringNotesMutationVariables } from "../__generated__/graphql"

/** The input of the `saveHiringNotes` mutation. */
export type MutateSaveHiringNotesRequest = WireInput<SaveHiringNotesMutationVariables["input"]>

/** The response of the `saveHiringNotes` mutation. */
type MutateSaveHiringNotesResponse = SaveHiringNotesMutation

const mutation1: TypedDocumentNode<MutateSaveHiringNotesResponse, InputVariables<MutateSaveHiringNotesRequest>> = gql`
    mutation SaveHiringNotes($input: SaveHiringNotesInput!) {
        saveHiringNotes(input: $input)
    }
`

enum MutationSaveHiringNotes {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveHiringNotes,
    TypedDocumentNode<MutateSaveHiringNotesResponse, InputVariables<MutateSaveHiringNotesRequest>>
> = {
    [MutationSaveHiringNotes.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveHiringNotes}. */
type MutateSaveHiringNotesParams = MutateParams<MutationSaveHiringNotes, MutateSaveHiringNotesRequest>

/** Runs the `saveHiringNotes` mutation. */
export const mutateSaveHiringNotes = async ({
    mutation = MutationSaveHiringNotes.Mutation1,
    request,
    signal,
}: MutateSaveHiringNotesParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
