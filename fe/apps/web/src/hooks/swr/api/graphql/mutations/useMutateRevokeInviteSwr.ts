"use client"

import { mutateRevokeInvite } from "@/modules/api/graphql/mutations/mutation-revoke-invite"
import type { mutateRevokeInvite as MutateRevokeInviteOperation } from "@/modules/api/graphql/mutations/mutation-revoke-invite"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the revokeInvite mutation. */
export const MUTATE_REVOKE_INVITE_SWR_KEY = "MUTATE_REVOKE_INVITE_SWR"

/** SWR mutation for {@link mutateRevokeInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevokeInviteSwr = () =>
    useSWRMutation(
        MUTATE_REVOKE_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRevokeInvite({ request: arg }), MUTATE_REVOKE_INVITE_SWR_KEY).revokeInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRevokeInviteOperation>[0]["request"]
}
