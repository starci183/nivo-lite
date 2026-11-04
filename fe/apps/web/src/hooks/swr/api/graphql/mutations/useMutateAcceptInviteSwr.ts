"use client"

import {
    mutateAcceptInvite,
    type mutateAcceptInvite as MutateAcceptInviteOperation,
} from "@/modules/api/graphql/mutations/mutation-accept-invite"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { AcceptInviteMutation } from "@/modules/api"

/** The SWR key of the acceptInvite mutation. */
export const MUTATE_ACCEPT_INVITE_SWR_KEY = "MUTATE_ACCEPT_INVITE_SWR"

/** SWR mutation for {@link mutateAcceptInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAcceptInviteSwr = (): SWRMutationResponse<
    AcceptInviteMutation["acceptInvite"],
    Error,
    typeof MUTATE_ACCEPT_INVITE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_ACCEPT_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAcceptInvite({ request: arg }), MUTATE_ACCEPT_INVITE_SWR_KEY).acceptInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAcceptInviteOperation>[0]["request"]
}
