import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type MutateParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ResetWorkspaceThemeMutation } from "../__generated__/graphql"

/** The response of the `resetWorkspaceTheme` mutation: the typed payload straight from the back end contract. */
type MutateResetWorkspaceThemeResponse = ResetWorkspaceThemeMutation

const mutation1: TypedDocumentNode<MutateResetWorkspaceThemeResponse> = gql`
    mutation ResetWorkspaceTheme {
        resetWorkspaceTheme
    }
`

/** Apollo params for {@link mutateResetWorkspaceTheme}. */
type MutateResetWorkspaceThemeParams = Omit<MutateParams<never, never>, "request" | "mutation">

/** The back end `resetWorkspaceTheme` mutation: returns the open workspace to the NIVO default theme (owner and manager). */
export const mutateResetWorkspaceTheme = (
    params: MutateResetWorkspaceThemeParams = {},
): Promise<ApolloClient.MutateResult<MutateResetWorkspaceThemeResponse>> =>
    createAuthApolloClient(webApiTransport, { signal: params.signal }).mutate({ mutation: mutation1 })
