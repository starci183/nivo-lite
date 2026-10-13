import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveLoyaltyProgramRequest, MutateSaveLoyaltyProgramResponse } from "./types/save-loyalty-program"

const mutation1 = gql`
    mutation SaveLoyaltyProgram($input: SaveLoyaltyProgramInput!) {
        saveLoyaltyProgram(input: $input) {
            enabled name slug
        }
    }
`

export enum MutationSaveLoyaltyProgram {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveLoyaltyProgram, DocumentNode> = {
    [MutationSaveLoyaltyProgram.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveLoyaltyProgram}. */
export type MutationSaveLoyaltyProgramParams = MutateParams<MutationSaveLoyaltyProgram, MutateSaveLoyaltyProgramRequest>

/** Saves the loyalty programme (name, enabled switch, whole config). */
export const mutateSaveLoyaltyProgram = async ({ mutation = MutationSaveLoyaltyProgram.Mutation1, request, signal }: MutationSaveLoyaltyProgramParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateSaveLoyaltyProgramResponse, InputVariables<MutateSaveLoyaltyProgramRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
