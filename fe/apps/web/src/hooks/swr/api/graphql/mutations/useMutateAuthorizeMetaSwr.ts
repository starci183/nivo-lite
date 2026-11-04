"use client"

import {
    mutateAuthorizeMeta,
    type mutateAuthorizeMeta as MutateAuthorizeMetaOperation,
} from "@/modules/api/graphql/mutations/mutation-authorize-meta"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { AuthorizeMetaMutation } from "@/modules/api"

/** The SWR key of the authorizeMeta mutation. */
export const MUTATE_AUTHORIZE_META_SWR_KEY = "MUTATE_AUTHORIZE_META_SWR"

/** SWR mutation for {@link mutateAuthorizeMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeMetaSwr = (): SWRMutationResponse<
    AuthorizeMetaMutation["authorizeMeta"],
    Error,
    typeof MUTATE_AUTHORIZE_META_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_AUTHORIZE_META_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAuthorizeMeta({ request: arg }), MUTATE_AUTHORIZE_META_SWR_KEY).authorizeMeta,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAuthorizeMetaOperation>[0]["request"]
}
