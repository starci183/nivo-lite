import useSWRMutation from "swr/mutation"
import { mutateAuthorizeMeta } from "@/modules/api/graphql/mutations/mutation-authorize-meta"
import type { MutateAuthorizeMetaRequest } from "@/modules/api/graphql/mutations/mutation-authorize-meta"

/** What the authorizeMeta mutation is triggered with. */
interface AuthorizeMetaArg {
    readonly arg: MutateAuthorizeMetaRequest
}

/** The SWR key of the authorizeMeta mutation. */
export const MUTATE_AUTHORIZE_META_SWR_KEY = "MUTATE_AUTHORIZE_META_SWR"

/** SWR mutation for {@link mutateAuthorizeMeta}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeMetaSwr = () =>
    useSWRMutation(MUTATE_AUTHORIZE_META_SWR_KEY, async (_key: string, { arg }: AuthorizeMetaArg) => {
        const result = await mutateAuthorizeMeta({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("authorizeMeta answered no data")
        return result.data.authorizeMeta
    })
