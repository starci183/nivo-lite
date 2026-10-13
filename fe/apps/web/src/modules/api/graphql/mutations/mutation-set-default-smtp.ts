import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetDefaultSmtpMutation, SetDefaultSmtpMutationVariables } from "../__generated__/graphql"

/** The input of the `setDefaultSmtp` mutation. */
type MutateSetDefaultSmtpRequest = WireInput<SetDefaultSmtpMutationVariables["input"]>

/** The response of the `setDefaultSmtp` mutation. */
type MutateSetDefaultSmtpResponse = SetDefaultSmtpMutation

const mutation1: TypedDocumentNode<MutateSetDefaultSmtpResponse, InputVariables<MutateSetDefaultSmtpRequest>> = gql`
    mutation SetDefaultSmtp($input: SetDefaultSmtpInput!) {
        setDefaultSmtp(input: $input)
    }
`

enum MutationSetDefaultSmtp {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetDefaultSmtp,
    TypedDocumentNode<MutateSetDefaultSmtpResponse, InputVariables<MutateSetDefaultSmtpRequest>>
> = {
    [MutationSetDefaultSmtp.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetDefaultSmtp}. */
type MutateSetDefaultSmtpParams = MutateParams<MutationSetDefaultSmtp, MutateSetDefaultSmtpRequest>

/** Makes a connected SMTP connection the default sender. */
export const mutateSetDefaultSmtp = async ({
    mutation = MutationSetDefaultSmtp.Mutation1,
    request,
    signal,
}: MutateSetDefaultSmtpParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
