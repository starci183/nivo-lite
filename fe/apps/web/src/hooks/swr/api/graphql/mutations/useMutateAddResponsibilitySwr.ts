"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateAddResponsibility,
    type MutateAddResponsibilityRequest,
} from "@/modules/api/graphql/mutations/mutation-add-responsibility"
import type { SWRMutationResponse } from "swr/mutation"
import type { AddResponsibilityMutation } from "@/modules/api"

/** What the addResponsibility mutation is triggered with. */
interface AddResponsibilityArg {
    readonly arg: MutateAddResponsibilityRequest
}

/** The SWR key of the addResponsibility mutation. */
export const MUTATE_ADD_RESPONSIBILITY_SWR_KEY = "MUTATE_ADD_RESPONSIBILITY_SWR"

/** SWR mutation for {@link mutateAddResponsibility}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateAddResponsibilitySwr = (): SWRMutationResponse<
    AddResponsibilityMutation["addResponsibility"],
    Error,
    typeof MUTATE_ADD_RESPONSIBILITY_SWR_KEY,
    AddResponsibilityArg["arg"]
> =>
    useSWRMutation(MUTATE_ADD_RESPONSIBILITY_SWR_KEY, async (_key: string, { arg }: AddResponsibilityArg) => {
        const result = await mutateAddResponsibility({ request: arg })
        if (!result.data) throw new Error("addResponsibility answered no data")
        return result.data.addResponsibility
    })
