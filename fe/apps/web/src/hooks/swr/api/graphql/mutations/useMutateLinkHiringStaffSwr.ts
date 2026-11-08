"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateLinkHiringStaff,
    type MutateLinkHiringStaffRequest,
} from "@/modules/api/graphql/mutations/mutation-link-hiring-staff"
import type { LinkHiringStaffMutation } from "@/modules/api"

/** What the linkHiringStaff mutation is triggered with. */
interface LinkHiringStaffArg {
    readonly arg: MutateLinkHiringStaffRequest
}

/** The SWR key of the `linkHiringStaff` mutation. */
export const MUTATE_LINK_HIRING_STAFF_SWR_KEY = "MUTATE_LINK_HIRING_STAFF_SWR"

/** SWR mutation for {@link mutateLinkHiringStaff}: `trigger(request)` answers `linkHiringStaff` and rejects with the back end failure. */
export const useMutateLinkHiringStaffSwr = (): SWRMutationResponse<
    LinkHiringStaffMutation["linkHiringStaff"],
    Error,
    typeof MUTATE_LINK_HIRING_STAFF_SWR_KEY,
    LinkHiringStaffArg["arg"]
> =>
    useSWRMutation(MUTATE_LINK_HIRING_STAFF_SWR_KEY, async (_key: string, { arg }: LinkHiringStaffArg) => {
        const result = await mutateLinkHiringStaff({ request: arg })
        if (!result.data) throw new Error("linkHiringStaff answered no data")
        return result.data.linkHiringStaff
    })
