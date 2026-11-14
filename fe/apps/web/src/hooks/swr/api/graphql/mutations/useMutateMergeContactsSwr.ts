"use client"

import {
    mutateMergeContacts,
    type mutateMergeContacts as MutateMergeContactsOperation,
} from "@/modules/api/graphql/mutations/mutation-merge-contacts"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { MergeContactsMutation } from "@/modules/api"

/** The SWR key of the mergeContacts mutation. */
export const MUTATE_MERGE_CONTACTS_SWR_KEY = "MUTATE_MERGE_CONTACTS_SWR"

/** SWR mutation for {@link mutateMergeContacts}: Merges one person into another. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMergeContactsSwr = (): SWRMutationResponse<
    MergeContactsMutation["mergeContacts"],
    Error,
    typeof MUTATE_MERGE_CONTACTS_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_MERGE_CONTACTS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateMergeContacts({ request: arg }), MUTATE_MERGE_CONTACTS_SWR_KEY).mergeContacts,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateMergeContactsOperation>[0]["request"]
}
