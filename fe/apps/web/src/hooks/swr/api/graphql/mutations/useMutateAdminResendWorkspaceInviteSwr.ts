"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateAdminResendWorkspaceInvite,
    type MutateAdminResendWorkspaceInviteRequest,
} from "@/modules/api/graphql/mutations/mutation-admin-resend-workspace-invite"
import type { SWRMutationResponse } from "swr/mutation"
import type { AdminResendWorkspaceInviteMutation } from "@/modules/api"

/** What the admin resend workspace invite mutation is triggered with. */
interface AdminResendWorkspaceInviteArg {
    readonly arg: MutateAdminResendWorkspaceInviteRequest
}

/** The SWR key of the admin resend workspace invite mutation. */
export const MUTATE_ADMIN_RESEND_WORKSPACE_INVITE_SWR_KEY = "MUTATE_ADMIN_RESEND_WORKSPACE_INVITE_SWR"

/** SWR mutation for {@link mutateAdminResendWorkspaceInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAdminResendWorkspaceInviteSwr = (): SWRMutationResponse<
    AdminResendWorkspaceInviteMutation["adminResendWorkspaceInvite"],
    Error,
    typeof MUTATE_ADMIN_RESEND_WORKSPACE_INVITE_SWR_KEY,
    AdminResendWorkspaceInviteArg["arg"]
> =>
    useSWRMutation(
        MUTATE_ADMIN_RESEND_WORKSPACE_INVITE_SWR_KEY,
        async (_key: string, { arg }: AdminResendWorkspaceInviteArg) => {
            const result = await mutateAdminResendWorkspaceInvite({ request: arg })
            if (!result.data) throw new Error("adminResendWorkspaceInvite answered no data")
            return result.data.adminResendWorkspaceInvite
        },
    )
