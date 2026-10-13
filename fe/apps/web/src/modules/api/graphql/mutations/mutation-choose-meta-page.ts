import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationChooseMetaPageArgs } from "../__generated__/schema"

/** The input of the `chooseMetaPage` mutation. */
export type MutateChooseMetaPageRequest = MutationChooseMetaPageArgs["input"]

/** The response of the `chooseMetaPage` mutation. */
type MutateChooseMetaPageResponse = Pick<Mutation, "chooseMetaPage">

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
