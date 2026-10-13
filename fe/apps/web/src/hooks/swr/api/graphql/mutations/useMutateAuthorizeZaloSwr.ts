import useSWRMutation from "swr/mutation"
import { mutateAuthorizeZalo } from "@/modules/api/graphql/mutations/mutation-authorize-zalo"
import type { MutateAuthorizeZaloRequest } from "@/modules/api/graphql/mutations/mutation-authorize-zalo"

/** What the authorizeZalo mutation is triggered with. */
interface AuthorizeZaloArg {
    readonly arg: MutateAuthorizeZaloRequest
}

/** The SWR key of the authorizeZalo mutation. */
export const MUTATE_AUTHORIZE_ZALO_SWR_KEY = "MUTATE_AUTHORIZE_ZALO_SWR"

/** SWR mutation for {@link mutateAuthorizeZalo}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeZaloSwr = () =>
    useSWRMutation(MUTATE_AUTHORIZE_ZALO_SWR_KEY, async (_key: string, { arg }: AuthorizeZaloArg) => {
        const result = await mutateAuthorizeZalo({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("authorizeZalo answered no data")
        return result.data.authorizeZalo
    })
