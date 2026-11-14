"use client"

import {
    mutateLinkContactIdentity,
    type mutateLinkContactIdentity as MutateLinkContactIdentityOperation,
} from "@/modules/api/graphql/mutations/mutation-link-contact-identity"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { LinkContactIdentityMutation } from "@/modules/api"

/** The SWR key of the linkContactIdentity mutation. */
export const MUTATE_LINK_CONTACT_IDENTITY_SWR_KEY = "MUTATE_LINK_CONTACT_IDENTITY_SWR"

/** SWR mutation for {@link mutateLinkContactIdentity}: Links one more identity to a person. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateLinkContactIdentitySwr = (): SWRMutationResponse<
    LinkContactIdentityMutation["linkContactIdentity"],
    Error,
    typeof MUTATE_LINK_CONTACT_IDENTITY_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_LINK_CONTACT_IDENTITY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateLinkContactIdentity({ request: arg }), MUTATE_LINK_CONTACT_IDENTITY_SWR_KEY)
                .linkContactIdentity,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateLinkContactIdentityOperation>[0]["request"]
}
