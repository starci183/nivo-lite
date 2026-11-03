"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateAssignResponsibility,
    type MutateAssignResponsibilityRequest,
} from "@/modules/api/graphql/mutations/mutation-assign-responsibility"
import type { SWRMutationResponse } from "swr/mutation"
import type { AssignResponsibilityMutation } from "@/modules/api"

/** What the assignResponsibility mutation is triggered with. */
interface AssignResponsibilityArg {
    readonly arg: MutateAssignResponsibilityRequest
}

/** The SWR key of the assignResponsibility mutation. */
export const MUTATE_ASSIGN_RESPONSIBILITY_SWR_KEY = "MUTATE_ASSIGN_RESPONSIBILITY_SWR"

/** SWR mutation for {@link mutateAssignResponsibility}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateAssignResponsibilitySwr = (): SWRMutationResponse<
    AssignResponsibilityMutation["assignResponsibility"],
    Error,
    typeof MUTATE_ASSIGN_RESPONSIBILITY_SWR_KEY,
    AssignResponsibilityArg["arg"]
> =>
    useSWRMutation(MUTATE_ASSIGN_RESPONSIBILITY_SWR_KEY, async (_key: string, { arg }: AssignResponsibilityArg) => {
        const result = await mutateAssignResponsibility({ request: arg })
        if (!result.data) throw new Error("assignResponsibility answered no data")
        return result.data.assignResponsibility
    })
