import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ChooseMetaPageMutation, ChooseMetaPageMutationVariables } from "../__generated__/graphql"

/** The input of the `chooseMetaPage` mutation. */
type MutateChooseMetaPageRequest = WireInput<ChooseMetaPageMutationVariables["input"]>

/** The response of the `chooseMetaPage` mutation. */
type MutateChooseMetaPageResponse = ChooseMetaPageMutation

const mutation1: TypedDocumentNode<MutateChooseMetaPageResponse, InputVariables<MutateChooseMetaPageRequest>> = gql`
    mutation ChooseMetaPage($input: ChooseMetaPageInput!) {
        chooseMetaPage(input: $input) {
            id
            name
            status
            configured
            pages {
                id
                name
                category
                igId
                igUsername
            }
            pageId
            pageName
            igId
            igUsername
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum MutationChooseMetaPage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationChooseMetaPage,
    TypedDocumentNode<MutateChooseMetaPageResponse, InputVariables<MutateChooseMetaPageRequest>>
> = {
    [MutationChooseMetaPage.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateChooseMetaPage}. */
type MutateChooseMetaPageParams = MutateParams<MutationChooseMetaPage, MutateChooseMetaPageRequest>

/** Binds the chosen Facebook Page to the connection. */
export const mutateChooseMetaPage = async ({
    mutation = MutationChooseMetaPage.Mutation1,
    request,
    signal,
}: MutateChooseMetaPageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
