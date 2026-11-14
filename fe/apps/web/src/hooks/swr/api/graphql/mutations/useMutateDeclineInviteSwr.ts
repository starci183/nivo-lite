"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateDeclineInvite,
    type mutateDeclineInvite as MutateDeclineInviteOperation,
} from "@/modules/api/graphql/mutations/mutation-decline-invite"
import { answeredData } from "@/hooks/workspaceread"
import type { DeclineInviteMutation } from "@/modules/api"

/** The SWR key of the declineInvite mutation. */
export const MUTATE_DECLINE_INVITE_SWR_KEY = "MUTATE_DECLINE_INVITE_SWR"

/** SWR mutation for {@link mutateDeclineInvite}: `trigger({ inviteId })` declines an invitation to the signed-in person. */
export const useMutateDeclineInviteSwr = (): SWRMutationResponse<
    DeclineInviteMutation["declineInvite"],
    Error,
    typeof MUTATE_DECLINE_INVITE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_DECLINE_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDeclineInvite({ request: arg }), MUTATE_DECLINE_INVITE_SWR_KEY).declineInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDeclineInviteOperation>[0]["request"]
}
