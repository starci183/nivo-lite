import useSWRMutation from "swr/mutation"
import { mutateAuthorizeGoogle } from "@/modules/api/graphql/mutations/mutation-authorize-google"
import type { MutateAuthorizeGoogleRequest } from "@/modules/api/graphql/mutations/mutation-authorize-google"

/** What the authorizeGoogle mutation is triggered with. */
interface AuthorizeGoogleArg {
    readonly arg: MutateAuthorizeGoogleRequest
}

/** The SWR key of the authorizeGoogle mutation. */
export const MUTATE_AUTHORIZE_GOOGLE_SWR_KEY = "MUTATE_AUTHORIZE_GOOGLE_SWR"

/** SWR mutation for {@link mutateAuthorizeGoogle}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeGoogleSwr = () =>
    useSWRMutation(MUTATE_AUTHORIZE_GOOGLE_SWR_KEY, async (_key: string, { arg }: AuthorizeGoogleArg) => {
        const result = await mutateAuthorizeGoogle({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("authorizeGoogle answered no data")
        return result.data.authorizeGoogle
    })
