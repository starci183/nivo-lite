"use client"

import { mutateChangeMemberRole } from "@/modules/api/graphql/mutations/mutation-change-member-role"
import type { mutateChangeMemberRole as MutateChangeMemberRoleOperation } from "@/modules/api/graphql/mutations/mutation-change-member-role"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the changeMemberRole mutation. */
export const MUTATE_CHANGE_MEMBER_ROLE_SWR_KEY = "MUTATE_CHANGE_MEMBER_ROLE_SWR"

/** SWR mutation for {@link mutateChangeMemberRole}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangeMemberRoleSwr = () =>
    useSWRMutation(
        MUTATE_CHANGE_MEMBER_ROLE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateChangeMemberRole({ request: arg }), MUTATE_CHANGE_MEMBER_ROLE_SWR_KEY)
                .changeMemberRole,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateChangeMemberRoleOperation>[0]["request"]
}
