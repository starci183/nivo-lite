"use client"

import {
    mutateDeleteContact,
    type mutateDeleteContact as MutateDeleteContactOperation,
} from "@/modules/api/graphql/mutations/mutation-delete-contact"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { DeleteContactMutation } from "@/modules/api"

/** The SWR key of the deleteContact mutation. */
export const MUTATE_DELETE_CONTACT_SWR_KEY = "MUTATE_DELETE_CONTACT_SWR"

/** SWR mutation for {@link mutateDeleteContact}: Deletes a person. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDeleteContactSwr = (): SWRMutationResponse<
    DeleteContactMutation["deleteContact"],
    Error,
    typeof MUTATE_DELETE_CONTACT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_DELETE_CONTACT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDeleteContact({ request: arg }), MUTATE_DELETE_CONTACT_SWR_KEY).deleteContact,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDeleteContactOperation>[0]["request"]
}
