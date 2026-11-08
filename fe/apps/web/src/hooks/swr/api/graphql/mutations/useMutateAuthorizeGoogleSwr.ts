"use client"

import {
    mutateAuthorizeGoogle,
    type mutateAuthorizeGoogle as MutateAuthorizeGoogleOperation,
} from "@/modules/api/graphql/mutations/mutation-authorize-google"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { AuthorizeGoogleMutation } from "@/modules/api"

/** The SWR key of the authorizeGoogle mutation. */
export const MUTATE_AUTHORIZE_GOOGLE_SWR_KEY = "MUTATE_AUTHORIZE_GOOGLE_SWR"

/** SWR mutation for {@link mutateAuthorizeGoogle}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAuthorizeGoogleSwr = (): SWRMutationResponse<
    AuthorizeGoogleMutation["authorizeGoogle"],
    Error,
    typeof MUTATE_AUTHORIZE_GOOGLE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_AUTHORIZE_GOOGLE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAuthorizeGoogle({ request: arg }), MUTATE_AUTHORIZE_GOOGLE_SWR_KEY)
                .authorizeGoogle,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAuthorizeGoogleOperation>[0]["request"]
}
