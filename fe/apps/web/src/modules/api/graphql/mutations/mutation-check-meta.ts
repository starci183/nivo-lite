import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCheckMetaArgs } from "../__generated__/schema"

/** The input of the `checkMeta` mutation. */
export type MutateCheckMetaRequest = MutationCheckMetaArgs["input"]

/** The response of the `checkMeta` mutation. */
type MutateCheckMetaResponse = Pick<Mutation, "checkMeta">

const mutation1: TypedDocumentNode<MutateCheckMetaResponse, InputVariables<MutateCheckMetaRequest>> = gql`
    mutation CheckMeta($input: CheckMetaInput!) {
        checkMeta(input: $input) {
            ok
            tokenOk
            pageId
            pageName
            igUsername
            pageSubscription {
                subscribed
                fields
                missing
            }
            appPage {
                callbackUrl
                fields
                missing
                urlMatches
            }
            appInstagram {
                callbackUrl
                fields
                missing
                urlMatches
            }
            appKnown
            webhookUrl
            localOnly
            verifyTokenSet
            repaired
        }
    }
`

enum MutationCheckMeta {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCheckMeta,
    TypedDocumentNode<MutateCheckMetaResponse, InputVariables<MutateCheckMetaRequest>>
> = {
    [MutationCheckMeta.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCheckMeta}. */
type MutateCheckMetaParams = MutateParams<MutationCheckMeta, MutateCheckMetaRequest>

/** Asks Meta what it really has for a connection, optionally repairing it. */
export const mutateCheckMeta = async ({
    mutation = MutationCheckMeta.Mutation1,
    request,
    signal,
}: MutateCheckMetaParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
