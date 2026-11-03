"use client"

import { mutateChangePassword } from "@/modules/api/graphql/mutations/mutation-change-password"
import type { mutateChangePassword as MutateChangePasswordOperation } from "@/modules/api/graphql/mutations/mutation-change-password"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the changePassword mutation. */
export const MUTATE_CHANGE_PASSWORD_SWR_KEY = "MUTATE_CHANGE_PASSWORD_SWR"

/** SWR mutation for {@link mutateChangePassword}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangePasswordSwr = (): SWRMutationResponse<
    OperationData<typeof mutateChangePassword>["changePassword"],
    Error,
    typeof MUTATE_CHANGE_PASSWORD_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CHANGE_PASSWORD_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateChangePassword({ request: arg }), MUTATE_CHANGE_PASSWORD_SWR_KEY).changePassword,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateChangePasswordOperation>[0]["request"]
}
