"use client"

import { mutateCreateInvite } from "@/modules/api/graphql/mutations/mutation-create-invite"
import type { mutateCreateInvite as MutateCreateInviteOperation } from "@/modules/api/graphql/mutations/mutation-create-invite"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the createInvite mutation. */
export const MUTATE_CREATE_INVITE_SWR_KEY = "MUTATE_CREATE_INVITE_SWR"

/** SWR mutation for {@link mutateCreateInvite}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateInviteSwr = () =>
    useSWRMutation(
        MUTATE_CREATE_INVITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCreateInvite({ request: arg }), MUTATE_CREATE_INVITE_SWR_KEY).createInvite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCreateInviteOperation>[0]["request"]
}
