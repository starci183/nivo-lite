"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateJoinInvite,
    type mutateJoinInvite as MutateJoinInviteOperation,
} from "@/modules/api/graphql/mutations/mutation-join-invite"
import { answeredData } from "@/hooks/workspaceread"
import type { JoinInviteMutation } from "@/modules/api"

/** The SWR key of the joinInvite mutation. */
export const MUTATE_JOIN_INVITE_SWR_KEY = "MUTATE_JOIN_INVITE_SWR"

/** SWR mutation for {@link mutateJoinInvite}: `trigger({ inviteId })` joins the workspace an invitation to the signed-in person names. */
export const useMutateJoinInviteSwr = (): SWRMutationResponse<
    JoinInviteMutation["joinInvite"],
    Error,
    typeof MUTATE_JOIN_INVITE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_JOIN_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateJoinInvite({ request: arg }), MUTATE_JOIN_INVITE_SWR_KEY).joinInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateJoinInviteOperation>[0]["request"]
}
