"use client"

import { mutateCancelTelegramLogin } from "@/modules/api/graphql/mutations/mutation-cancel-telegram-login"
import type { mutateCancelTelegramLogin as MutateCancelTelegramLoginOperation } from "@/modules/api/graphql/mutations/mutation-cancel-telegram-login"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the cancelTelegramLogin mutation. */
export const MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_CANCEL_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateCancelTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCancelTelegramLoginSwr = () =>
    useSWRMutation(
        MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCancelTelegramLogin({ request: arg }), MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY)
                .cancelTelegramLogin,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCancelTelegramLoginOperation>[0]["request"]
}
