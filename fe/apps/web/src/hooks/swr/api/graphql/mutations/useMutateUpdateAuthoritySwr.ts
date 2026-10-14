"use client"

import useSWRMutation from "swr/mutation"
import { mutateUpdateAuthority } from "@/modules/api/graphql/mutations/mutation-update-authority"
import type { MutateUpdateAuthorityRequest } from "@/modules/api/graphql/mutations/mutation-update-authority"

/** What the UpdateAuthority mutation is triggered with. */
interface UpdateAuthorityArg {
    readonly arg: MutateUpdateAuthorityRequest
}

/** The SWR key of {@link useMutateUpdateAuthoritySwr}. */
export const MUTATE_UPDATE_AUTHORITY_SWR_KEY = "MUTATE_UPDATE_AUTHORITY_SWR"

/** SWR mutation for {@link mutateUpdateAuthority}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateAuthoritySwr = () =>
    useSWRMutation(MUTATE_UPDATE_AUTHORITY_SWR_KEY, async (_key: string, { arg }: UpdateAuthorityArg) => {
        const result = await mutateUpdateAuthority({ request: arg })
        if (!result.data) throw new Error("updateAuthority answered no data")
        return result.data.updateAuthority
    })
