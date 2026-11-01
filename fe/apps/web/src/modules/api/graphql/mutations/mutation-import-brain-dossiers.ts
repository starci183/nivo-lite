import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ImportBrainDossiersMutation, ImportBrainDossiersMutationVariables } from "../__generated__/graphql"

/** The response of the `importBrainDossiers` mutation: the typed payload straight from the back end contract. */
type MutateImportBrainDossiersResponse = ImportBrainDossiersMutation

/** The input of the `importBrainDossiers` mutation. */
export type MutateImportBrainDossiersRequest = WireInput<ImportBrainDossiersMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateImportBrainDossiersResponse,
    InputVariables<MutateImportBrainDossiersRequest>
> = gql`
    mutation ImportBrainDossiers($input: ImportBrainDossiersInput!) {
        importBrainDossiers(input: $input) {
            imported
            skipped
            removed
        }
    }
`

enum MutationImportBrainDossiers {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationImportBrainDossiers,
    TypedDocumentNode<MutateImportBrainDossiersResponse, InputVariables<MutateImportBrainDossiersRequest>>
> = {
    [MutationImportBrainDossiers.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateImportBrainDossiers}. */
type MutateImportBrainDossiersParams = MutateParams<MutationImportBrainDossiers, MutateImportBrainDossiersRequest>

/**
 * Replaces the dossiers of the workspace with those of a checklist workbook (the back end `importBrainDossiers` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateImportBrainDossiers = async ({
    mutation = MutationImportBrainDossiers.Mutation1,
    request,
    signal,
}: MutateImportBrainDossiersParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
