import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveAuthorityRuleArgs } from "../__generated__/schema"

/** The input of the `saveAuthorityRule` mutation. */
export type MutateSaveAuthorityRuleRequest = MutationSaveAuthorityRuleArgs["input"]

type MutateSaveAuthorityRuleResponse = Pick<Mutation, "saveAuthorityRule">

const mutation1: TypedDocumentNode<
    MutateSaveAuthorityRuleResponse,
    InputVariables<MutateSaveAuthorityRuleRequest>
> = gql`
    mutation SaveAuthorityRule($input: SaveAuthorityRuleInput!) {
        saveAuthorityRule(input: $input) {
            action
            department
            id
            limit_vnd
            mode
            note
            required_fields
            updated_at
            workspace_id
        }
    }
`

enum MutationSaveAuthorityRule {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveAuthorityRule,
    TypedDocumentNode<MutateSaveAuthorityRuleResponse, InputVariables<MutateSaveAuthorityRuleRequest>>
> = {
    [MutationSaveAuthorityRule.Mutation1]: mutation1,
}

/** The back end `saveAuthorityRule` mutation. */
export const mutateSaveAuthorityRule = async ({
    mutation = MutationSaveAuthorityRule.Mutation1,
    request,
    signal,
}: MutateParams<MutationSaveAuthorityRule, MutateSaveAuthorityRuleRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
