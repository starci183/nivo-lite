"use client"

import useSWRMutation from "swr/mutation"
import { mutateAdminSetWorkspacePlan } from "@/modules/api/graphql/mutations/mutation-admin-set-workspace-plan"
import type { MutateAdminSetWorkspacePlanRequest } from "@/modules/api/graphql/mutations/mutation-admin-set-workspace-plan"

/** What the admin set workspace plan mutation is triggered with. */
interface AdminSetWorkspacePlanArg {
    readonly arg: MutateAdminSetWorkspacePlanRequest
}

/** The SWR key of the admin set workspace plan mutation. */
export const MUTATE_ADMIN_SET_WORKSPACE_PLAN_SWR_KEY = "MUTATE_ADMIN_SET_WORKSPACE_PLAN_SWR"

/** SWR mutation for {@link mutateAdminSetWorkspacePlan}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAdminSetWorkspacePlanSwr = () =>
    useSWRMutation(MUTATE_ADMIN_SET_WORKSPACE_PLAN_SWR_KEY, async (_key: string, { arg }: AdminSetWorkspacePlanArg) => {
        const result = await mutateAdminSetWorkspacePlan({ request: arg })
        if (!result.data) throw new Error("adminSetWorkspacePlan answered no data")
        return result.data.adminSetWorkspacePlan
    })
