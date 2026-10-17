"use client"

import { mutateResendInvite } from "@/modules/api/graphql/mutations/mutation-resend-invite"
import type { mutateResendInvite as MutateResendInviteOperation } from "@/modules/api/graphql/mutations/mutation-resend-invite"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the resendInvite mutation. */
export const MUTATE_RESEND_INVITE_SWR_KEY = "MUTATE_RESEND_INVITE_SWR"

/** SWR mutation for {@link mutateResendInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateResendInviteSwr = () =>
    useSWRMutation(
        MUTATE_RESEND_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateResendInvite({ request: arg }), MUTATE_RESEND_INVITE_SWR_KEY).resendInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateResendInviteOperation>[0]["request"]
}
