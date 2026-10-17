"use client"

import { mutateCopyInviteLink } from "@/modules/api/graphql/mutations/mutation-copy-invite-link"
import type { mutateCopyInviteLink as MutateCopyInviteLinkOperation } from "@/modules/api/graphql/mutations/mutation-copy-invite-link"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the copyInviteLink mutation. */
export const MUTATE_COPY_INVITE_LINK_SWR_KEY = "MUTATE_COPY_INVITE_LINK_SWR"

/** SWR mutation for {@link mutateCopyInviteLink}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCopyInviteLinkSwr = () =>
    useSWRMutation(
        MUTATE_COPY_INVITE_LINK_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCopyInviteLink({ request: arg }), MUTATE_COPY_INVITE_LINK_SWR_KEY).copyInviteLink,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCopyInviteLinkOperation>[0]["request"]
}
