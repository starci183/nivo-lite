import type { SyncLoyaltyMembersMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"

const mutation1 = gql`
    mutation SyncLoyaltyMembers {
        syncLoyaltyMembers {
            created
            linked
        }
    }
`

enum MutationSyncLoyaltyMembers {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSyncLoyaltyMembers, DocumentNode> = {
    [MutationSyncLoyaltyMembers.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSyncLoyaltyMembers}. */
type MutationSyncLoyaltyMembersParams = Omit<MutateParams<MutationSyncLoyaltyMembers, undefined>, "request">

/** Creates loyalty members for the customers of the workspace (no input). */
export const mutateSyncLoyaltyMembers = async ({
    mutation = MutationSyncLoyaltyMembers.Mutation1,
    signal,
}: MutationSyncLoyaltyMembersParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SyncLoyaltyMembersMutation>({ mutation: mutationMap[mutation] })
}
