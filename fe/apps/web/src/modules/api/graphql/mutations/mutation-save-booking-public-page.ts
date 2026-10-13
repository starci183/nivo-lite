import type { SaveBookingPublicPageMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveBookingPublicPageRequest } from "./types/save-booking-public-page"

const mutation1 = gql`
    mutation SaveBookingPublicPage($input: SaveBookingPublicPageInput!) {
        saveBookingPublicPage(input: $input) {
            workspaceId
        }
    }
`

enum MutationSaveBookingPublicPage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveBookingPublicPage, DocumentNode> = {
    [MutationSaveBookingPublicPage.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBookingPublicPage}. */
type MutationSaveBookingPublicPageParams = MutateParams<
    MutationSaveBookingPublicPage,
    MutateSaveBookingPublicPageRequest
>

/** Publishes or edits the public booking page of the workspace. */
export const mutateSaveBookingPublicPage = async ({
    mutation = MutationSaveBookingPublicPage.Mutation1,
    request,
    signal,
}: MutationSaveBookingPublicPageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SaveBookingPublicPageMutation, InputVariables<MutateSaveBookingPublicPageRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
