import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { RestoreWorkspaceMutation } from "../__generated__/graphql"

/** The response of the `restoreWorkspace` mutation: the typed payload straight from the back end contract. */
type MutateRestoreWorkspaceResponse = RestoreWorkspaceMutation

const mutation1: TypedDocumentNode<MutateRestoreWorkspaceResponse> = gql`
    mutation RestoreWorkspace {
        restoreWorkspace
    }
`

/** Apollo params for {@link mutateRestoreWorkspace}: the deleted workspace travels as the `X-Workspace-Id` header. */
type MutateRestoreWorkspaceParams = Omit<MutateParams<never, never>, "request" | "mutation">

/** Restores, within 30 days, a workspace its owner deleted (the back end `restoreWorkspace` mutation). */
export const mutateRestoreWorkspace = (
    params: MutateRestoreWorkspaceParams,
): Promise<ApolloClient.MutateResult<MutateRestoreWorkspaceResponse>> =>
    createAuthApolloClient({ signal: params.signal, headers: params.headers }).mutate({ mutation: mutation1 })
