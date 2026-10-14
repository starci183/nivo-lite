"use client"

import useSWRMutation from "swr/mutation"
import { mutateAdminSetWorkspaceStatus } from "@/modules/api/graphql/mutations/mutation-admin-set-workspace-status"
import type { MutateAdminSetWorkspaceStatusRequest } from "@/modules/api/graphql/mutations/mutation-admin-set-workspace-status"

/** What the admin set workspace status mutation is triggered with. */
interface AdminSetWorkspaceStatusArg {
    readonly arg: MutateAdminSetWorkspaceStatusRequest
}

/** The SWR key of the admin set workspace status mutation. */
export const MUTATE_ADMIN_SET_WORKSPACE_STATUS_SWR_KEY = "MUTATE_ADMIN_SET_WORKSPACE_STATUS_SWR"

/** SWR mutation for {@link mutateAdminSetWorkspaceStatus}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAdminSetWorkspaceStatusSwr = () =>
    useSWRMutation(
        MUTATE_ADMIN_SET_WORKSPACE_STATUS_SWR_KEY,
        async (_key: string, { arg }: AdminSetWorkspaceStatusArg) => {
            const result = await mutateAdminSetWorkspaceStatus({ request: arg })
            if (!result.data) throw new Error("adminSetWorkspaceStatus answered no data")
            return result.data.adminSetWorkspaceStatus
        },
    )
