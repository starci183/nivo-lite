"use client"

import {
    mutateStartTelegramLogin,
    type mutateStartTelegramLogin as MutateStartTelegramLoginOperation,
} from "@/modules/api/graphql/mutations/mutation-start-telegram-login"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { StartTelegramLoginMutation } from "@/modules/api"

/** The SWR key of the startTelegramLogin mutation. */
export const MUTATE_START_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_START_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateStartTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartTelegramLoginSwr = (): SWRMutationResponse<
    StartTelegramLoginMutation["startTelegramLogin"],
    Error,
    typeof MUTATE_START_TELEGRAM_LOGIN_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_START_TELEGRAM_LOGIN_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartTelegramLogin({ request: arg }), MUTATE_START_TELEGRAM_LOGIN_SWR_KEY)
                .startTelegramLogin,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartTelegramLoginOperation>[0]["request"]
}
