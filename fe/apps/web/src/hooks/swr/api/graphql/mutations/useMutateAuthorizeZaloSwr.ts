"use client"

import { mutateAuthorizeZalo } from "@/modules/api/graphql/mutations/mutation-authorize-zalo"
import type { mutateAuthorizeZalo as MutateAuthorizeZaloOperation } from "@/modules/api/graphql/mutations/mutation-authorize-zalo"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the authorizeZalo mutation. */
export const MUTATE_AUTHORIZE_ZALO_SWR_KEY = "MUTATE_AUTHORIZE_ZALO_SWR"

/** SWR mutation for {@link mutateAuthorizeZalo}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeZaloSwr = (): SWRMutationResponse<
    OperationData<typeof mutateAuthorizeZalo>["authorizeZalo"],
    Error,
    typeof MUTATE_AUTHORIZE_ZALO_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_AUTHORIZE_ZALO_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAuthorizeZalo({ request: arg }), MUTATE_AUTHORIZE_ZALO_SWR_KEY).authorizeZalo,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAuthorizeZaloOperation>[0]["request"]
}
