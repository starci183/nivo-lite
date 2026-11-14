"use client"

import {
    mutateUnlinkContactIdentity,
    type mutateUnlinkContactIdentity as MutateUnlinkContactIdentityOperation,
} from "@/modules/api/graphql/mutations/mutation-unlink-contact-identity"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { UnlinkContactIdentityMutation } from "@/modules/api"

/** The SWR key of the unlinkContactIdentity mutation. */
export const MUTATE_UNLINK_CONTACT_IDENTITY_SWR_KEY = "MUTATE_UNLINK_CONTACT_IDENTITY_SWR"

/** SWR mutation for {@link mutateUnlinkContactIdentity}: Takes one identity off a person. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUnlinkContactIdentitySwr = (): SWRMutationResponse<
    UnlinkContactIdentityMutation["unlinkContactIdentity"],
    Error,
    typeof MUTATE_UNLINK_CONTACT_IDENTITY_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UNLINK_CONTACT_IDENTITY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUnlinkContactIdentity({ request: arg }), MUTATE_UNLINK_CONTACT_IDENTITY_SWR_KEY)
                .unlinkContactIdentity,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateUnlinkContactIdentityOperation>[0]["request"]
}
