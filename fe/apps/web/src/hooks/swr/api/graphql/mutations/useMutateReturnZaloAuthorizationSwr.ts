import useSWRMutation from "swr/mutation"
import { mutateReturnZaloAuthorization } from "@/modules/api/graphql/mutations/mutation-return-zalo-authorization"
import type { MutateReturnZaloAuthorizationRequest } from "@/modules/api/graphql/mutations/mutation-return-zalo-authorization"

/** What the returnZaloAuthorization mutation is triggered with. */
interface ReturnZaloAuthorizationArg {
    readonly arg: MutateReturnZaloAuthorizationRequest
}

/** The SWR key of the returnZaloAuthorization mutation. */
export const MUTATE_RETURN_ZALO_AUTHORIZATION_SWR_KEY = "MUTATE_RETURN_ZALO_AUTHORIZATION_SWR"

/** SWR mutation for {@link mutateReturnZaloAuthorization}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateReturnZaloAuthorizationSwr = () =>
    useSWRMutation(
        MUTATE_RETURN_ZALO_AUTHORIZATION_SWR_KEY,
        async (_key: string, { arg }: ReturnZaloAuthorizationArg) => {
            const result = await mutateReturnZaloAuthorization({ request: arg })
            if (result.data === undefined || result.data === null)
                throw new Error("returnZaloAuthorization answered no data")
            return result.data.returnZaloAuthorization
        },
    )
