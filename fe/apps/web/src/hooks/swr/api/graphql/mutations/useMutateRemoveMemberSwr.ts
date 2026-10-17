"use client"

import { mutateRemoveMember } from "@/modules/api/graphql/mutations/mutation-remove-member"
import type { mutateRemoveMember as MutateRemoveMemberOperation } from "@/modules/api/graphql/mutations/mutation-remove-member"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the removeMember mutation. */
export const MUTATE_REMOVE_MEMBER_SWR_KEY = "MUTATE_REMOVE_MEMBER_SWR"

/** SWR mutation for {@link mutateRemoveMember}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRemoveMemberSwr = () =>
    useSWRMutation(
        MUTATE_REMOVE_MEMBER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRemoveMember({ request: arg }), MUTATE_REMOVE_MEMBER_SWR_KEY).removeMember,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRemoveMemberOperation>[0]["request"]
}
