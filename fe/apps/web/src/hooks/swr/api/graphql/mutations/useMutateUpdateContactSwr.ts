"use client"

import {
    mutateUpdateContact,
    type mutateUpdateContact as MutateUpdateContactOperation,
} from "@/modules/api/graphql/mutations/mutation-update-contact"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { UpdateContactMutation } from "@/modules/api"

/** The SWR key of the updateContact mutation. */
export const MUTATE_UPDATE_CONTACT_SWR_KEY = "MUTATE_UPDATE_CONTACT_SWR"

/** SWR mutation for {@link mutateUpdateContact}: Renames a person or sets their tags. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateContactSwr = (): SWRMutationResponse<
    UpdateContactMutation["updateContact"],
    Error,
    typeof MUTATE_UPDATE_CONTACT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UPDATE_CONTACT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUpdateContact({ request: arg }), MUTATE_UPDATE_CONTACT_SWR_KEY).updateContact,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateUpdateContactOperation>[0]["request"]
}
