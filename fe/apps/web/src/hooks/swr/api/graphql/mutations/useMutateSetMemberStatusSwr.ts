"use client"

import { mutateSetMemberStatus } from "@/modules/api/graphql/mutations/mutation-set-member-status"
import type { mutateSetMemberStatus as MutateSetMemberStatusOperation } from "@/modules/api/graphql/mutations/mutation-set-member-status"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setMemberStatus mutation. */
export const MUTATE_SET_MEMBER_STATUS_SWR_KEY = "MUTATE_SET_MEMBER_STATUS_SWR"

/** SWR mutation for {@link mutateSetMemberStatus}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetMemberStatusSwr = () =>
    useSWRMutation(
        MUTATE_SET_MEMBER_STATUS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetMemberStatus({ request: arg }), MUTATE_SET_MEMBER_STATUS_SWR_KEY)
                .setMemberStatus,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetMemberStatusOperation>[0]["request"]
}
