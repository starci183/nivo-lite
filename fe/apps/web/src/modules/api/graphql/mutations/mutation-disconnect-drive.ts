import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { DisconnectDriveMutation } from "../__generated__/graphql"

/** The response of the `disconnectDrive` mutation: the typed payload straight from the back end contract. */
type MutateDisconnectDriveResponse = DisconnectDriveMutation

const mutation1: TypedDocumentNode<MutateDisconnectDriveResponse> = gql`
    mutation DisconnectDrive {
        disconnectDrive
    }
`

enum MutationDisconnectDrive {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDisconnectDrive, TypedDocumentNode<MutateDisconnectDriveResponse>> = {
    [MutationDisconnectDrive.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDisconnectDrive}: no input, the workspace header scopes it. */
type MutateDisconnectDriveParams = Omit<MutateParams<MutationDisconnectDrive, undefined>, "request">

/** Forgets the Google Drive read grant of the active workspace (the back end `disconnectDrive` mutation). */
export const mutateDisconnectDrive = async ({
    mutation = MutationDisconnectDrive.Mutation1,
    signal,
}: MutateDisconnectDriveParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
