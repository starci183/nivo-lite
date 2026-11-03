"use client"

import { mutateCheckMeta } from "@/modules/api/graphql/mutations/mutation-check-meta"
import type { mutateCheckMeta as MutateCheckMetaOperation } from "@/modules/api/graphql/mutations/mutation-check-meta"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the checkMeta mutation. */
export const MUTATE_CHECK_META_SWR_KEY = "MUTATE_CHECK_META_SWR"

/** SWR mutation for {@link mutateCheckMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckMetaSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCheckMeta>["checkMeta"],
    Error,
    typeof MUTATE_CHECK_META_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CHECK_META_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCheckMeta({ request: arg }), MUTATE_CHECK_META_SWR_KEY).checkMeta,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCheckMetaOperation>[0]["request"]
}
