import useSWRMutation from "swr/mutation"
import { mutateCheckMeta } from "@/modules/api/graphql/mutations/mutation-check-meta"
import type { MutateCheckMetaRequest } from "@/modules/api/graphql/mutations/mutation-check-meta"

/** What the checkMeta mutation is triggered with. */
interface CheckMetaArg {
    readonly arg: MutateCheckMetaRequest
}

/** The SWR key of the checkMeta mutation. */
export const MUTATE_CHECK_META_SWR_KEY = "MUTATE_CHECK_META_SWR"

/** SWR mutation for {@link mutateCheckMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckMetaSwr = () =>
    useSWRMutation(MUTATE_CHECK_META_SWR_KEY, async (_key: string, { arg }: CheckMetaArg) => {
        const result = await mutateCheckMeta({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("checkMeta answered no data")
        return result.data.checkMeta
    })
