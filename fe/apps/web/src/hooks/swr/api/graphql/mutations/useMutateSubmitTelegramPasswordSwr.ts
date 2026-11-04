"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSubmitTelegramPassword,
    type MutateSubmitTelegramPasswordRequest,
} from "@/modules/api/graphql/mutations/mutation-submit-telegram-password"
import type { SWRMutationResponse } from "swr/mutation"
import type { SubmitTelegramPasswordMutation } from "@/modules/api"

/** What the submitTelegramPassword mutation is triggered with. */
interface SubmitTelegramPasswordArg {
    readonly arg: MutateSubmitTelegramPasswordRequest
}

/** The SWR key of the submitTelegramPassword mutation. */
export const MUTATE_SUBMIT_TELEGRAM_PASSWORD_SWR_KEY = "MUTATE_SUBMIT_TELEGRAM_PASSWORD_SWR"

/** SWR mutation for {@link mutateSubmitTelegramPassword}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitTelegramPasswordSwr = (): SWRMutationResponse<
    SubmitTelegramPasswordMutation["submitTelegramPassword"],
    Error,
    typeof MUTATE_SUBMIT_TELEGRAM_PASSWORD_SWR_KEY,
    SubmitTelegramPasswordArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SUBMIT_TELEGRAM_PASSWORD_SWR_KEY,
        async (_key: string, { arg }: SubmitTelegramPasswordArg) => {
            const result = await mutateSubmitTelegramPassword({ request: arg })
            if (result.data === undefined) throw new Error("submitTelegramPassword answered no data")
            return result.data.submitTelegramPassword
        },
    )
